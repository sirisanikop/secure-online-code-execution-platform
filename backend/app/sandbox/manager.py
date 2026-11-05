"""Sandbox Manager (DS-SBX-01, DS-SBX-03, DS-EXE-02).

Runs one program in an isolated child process:
  worker slot -> temp dir -> Job Object -> suspended python -> assign -> resume
  -> reader threads (capped) + wall-clock watchdog -> classify -> always clean up
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from .job_object import CREATE_NO_WINDOW, CREATE_SUSPENDED, IS_WINDOWS, JobObject, JobObjectError

BOOTSTRAP = str(Path(__file__).with_name("runner_bootstrap.py"))
_BOOT_FRAME = re.compile(r'  File "[^"]*runner_bootstrap\.py", line \d+, in [^\r\n]*\r?\n(?:    [^\r\n]*\r?\n)?')

COMPLETED = "COMPLETED"
RUNTIME_ERROR = "RUNTIME_ERROR"
TIMEOUT = "TIMEOUT"
MEMORY_LIMIT = "MEMORY_LIMIT"
OUTPUT_LIMIT = "OUTPUT_LIMIT"
BLOCKED = "BLOCKED"
INTERNAL_ERROR = "INTERNAL_ERROR"


@dataclass
class Limits:
    timeout_s: float
    memory_mb: int
    output_bytes: int


@dataclass
class RunResult:
    status: str
    stdout: str = ""
    stderr: str = ""
    exit_code: int | None = None
    runtime_ms: int = 0
    peak_mem_kb: int | None = None
    blocked_reason: str | None = None


class SandboxBusy(Exception):
    """Queue is full (HTTP 503)."""


class SandboxManager:
    def __init__(self, root: str, max_concurrent: int = 4, max_queue: int = 20, python_exe: str = "",
                 queue_wait_seconds: float = 60.0):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        # The venv's python.exe is a launcher that spawns the real interpreter as a *second* process,
        # which would violate ActiveProcessLimit=1; use the base interpreter directly.
        self.python = python_exe or getattr(sys, "_base_executable", sys.executable)
        self._sem = threading.BoundedSemaphore(max_concurrent)
        self._lock = threading.Lock()
        self._waiting = 0
        self._max_queue = max_queue
        self._queue_wait = queue_wait_seconds

    # ---- admission control ------------------------------------------------------------------
    def _acquire(self) -> None:
        if self._sem.acquire(blocking=False):
            return
        with self._lock:
            if self._waiting >= self._max_queue:
                raise SandboxBusy()
            self._waiting += 1
        try:
            if not self._sem.acquire(timeout=self._queue_wait):
                raise SandboxBusy()
        finally:
            with self._lock:
                self._waiting -= 1

    @property
    def waiting(self) -> int:
        return self._waiting

    def sweep_stale(self) -> int:
        """Delete leftover run directories from a previous crash (R4)."""
        n = 0
        for d in self.root.glob("run_*"):
            shutil.rmtree(d, ignore_errors=True)
            n += 1
        return n

    # ---- execution --------------------------------------------------------------------------
    def run(self, source: str, stdin: str, limits: Limits) -> RunResult:
        if not IS_WINDOWS:
            return RunResult(INTERNAL_ERROR, stderr="The sandbox requires Windows (Job Objects).")
        self._acquire()
        workdir = None
        job = None
        proc = None
        try:
            workdir = tempfile.mkdtemp(prefix="run_", dir=self.root)
            main_py = os.path.join(workdir, "main.py")
            with open(main_py, "w", encoding="utf-8", newline="") as f:
                f.write(source)
            job = JobObject(limits.memory_mb * 1024 * 1024, limits.timeout_s + 1.0)
            env = {
                "SystemRoot": os.environ.get("SystemRoot", r"C:\Windows"),
                "TEMP": workdir, "TMP": workdir,
                "PYTHONDONTWRITEBYTECODE": "1",
            }
            proc = subprocess.Popen(
                [self.python, "-I", "-S", "-B", "-u", "-X", "utf8", BOOTSTRAP, main_py],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                cwd=workdir, env=env, bufsize=0, close_fds=True,
                creationflags=CREATE_SUSPENDED | CREATE_NO_WINDOW,
            )
            job.assign(proc._handle)
            return self._supervise(proc, job, stdin, limits, workdir)
        except (JobObjectError, OSError) as e:
            return RunResult(INTERNAL_ERROR, stderr="Internal error starting the sandbox.", blocked_reason=str(e)[:200])
        finally:
            try:
                if job is not None:
                    job.terminate()
                if proc is not None:
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                    for s in (proc.stdin, proc.stdout, proc.stderr):
                        try:
                            if s:
                                s.close()
                        except OSError:
                            pass
                if job is not None:
                    job.close()
                if workdir:
                    shutil.rmtree(workdir, ignore_errors=True)
            finally:
                self._sem.release()

    def _supervise(self, proc, job: JobObject, stdin: str, limits: Limits, workdir: str) -> RunResult:
        out, err = [], []
        exceeded = threading.Event()
        cap = limits.output_bytes

        def reader(stream, sink):
            total = 0
            try:
                while True:
                    chunk = stream.read(8192)
                    if not chunk:
                        return
                    room = cap - total
                    if room > 0:
                        sink.append(chunk[:room])
                    total += len(chunk)
                    if total > cap:
                        exceeded.set()
                        job.terminate()
                        return
            except (OSError, ValueError):
                return

        def feeder():
            try:
                if stdin:
                    proc.stdin.write(stdin.encode("utf-8"))
            except (OSError, ValueError):
                pass
            finally:
                try:
                    proc.stdin.close()
                except OSError:
                    pass

        threads = [threading.Thread(target=reader, args=(proc.stdout, out), daemon=True),
                   threading.Thread(target=reader, args=(proc.stderr, err), daemon=True),
                   threading.Thread(target=feeder, daemon=True)]
        started = time.perf_counter()
        JobObject.resume(proc._handle)
        for t in threads:
            t.start()

        timed_out = False
        try:
            proc.wait(timeout=limits.timeout_s)
        except subprocess.TimeoutExpired:
            timed_out = True
            job.terminate()
            proc.wait()
        elapsed = time.perf_counter() - started
        for t in threads[:2]:
            t.join(timeout=2)
        peak = job.peak_memory_kb()

        stdout = b"".join(out).decode("utf-8", "replace").replace("\r\n", "\n")
        stderr = _BOOT_FRAME.sub("", b"".join(err).decode("utf-8", "replace").replace("\r\n", "\n"))
        stderr = stderr.replace(workdir, "<sandbox>").replace(BOOTSTRAP, "<sandbox-runner>")
        code = proc.returncode
        mem_limit_kb = limits.memory_mb * 1024

        if exceeded.is_set():
            status = OUTPUT_LIMIT
            stderr = (stderr + "\n" if stderr else "") + f"[output exceeded {cap} bytes - program terminated]"
        elif timed_out:
            status = TIMEOUT
            stderr = (stderr + "\n" if stderr else "") + f"[time limit of {limits.timeout_s:g} s exceeded - program terminated]"
        elif code == 0:
            status = COMPLETED
        elif "MemoryError" in stderr or (peak is not None and peak >= 0.9 * mem_limit_kb):
            status = MEMORY_LIMIT
            stderr = (stderr + "\n" if stderr else "") + f"[memory limit of {limits.memory_mb} MB exceeded]"
        elif elapsed >= limits.timeout_s:
            status = TIMEOUT  # killed by the Job Object CPU-time backstop
            stderr = (stderr + "\n" if stderr else "") + f"[time limit of {limits.timeout_s:g} s exceeded - program terminated]"
        else:
            status = RUNTIME_ERROR
        return RunResult(status, stdout, stderr, code, int(elapsed * 1000), peak)
