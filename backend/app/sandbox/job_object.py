"""Thin ctypes wrapper around the Windows Job Object API (DS-SBX-01).

A Job Object groups processes and lets the kernel enforce limits on them. We use it for:
  * process memory limit            (JOB_OBJECT_LIMIT_PROCESS_MEMORY)
  * active process limit = 1        (no fork bombs / child processes)
  * per-process user CPU time       (backstop for the wall-clock watchdog)
  * kill-on-close                   (nothing survives if the server dies or the handle is closed)
  * UI restrictions                 (no clipboard / window / desktop access)
"""
import ctypes
import os
from ctypes import wintypes

IS_WINDOWS = os.name == "nt"

JOB_OBJECT_LIMIT_PROCESS_TIME = 0x00000002
JOB_OBJECT_LIMIT_ACTIVE_PROCESS = 0x00000008
JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100
JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION = 0x00000400
JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000

JobObjectBasicUIRestrictions = 4
JobObjectExtendedLimitInformation = 9
JOB_OBJECT_UILIMIT_ALL = 0x000000FF

CREATE_SUSPENDED = 0x00000004
CREATE_NO_WINDOW = 0x08000000


class _IO_COUNTERS(ctypes.Structure):
    _fields_ = [(n, ctypes.c_ulonglong) for n in (
        "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
        "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]


class _BASIC_LIMIT(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_int64),
        ("PerJobUserTimeLimit", ctypes.c_int64),
        ("LimitFlags", wintypes.DWORD),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", wintypes.DWORD),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", wintypes.DWORD),
        ("SchedulingClass", wintypes.DWORD),
    ]


class _EXT_LIMIT(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", _BASIC_LIMIT),
        ("IoInfo", _IO_COUNTERS),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


class _UI_RESTRICT(ctypes.Structure):
    _fields_ = [("UIRestrictionsClass", wintypes.DWORD)]


if IS_WINDOWS:
    _k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    _ntdll = ctypes.WinDLL("ntdll")
    _k32.CreateJobObjectW.argtypes = [wintypes.LPVOID, wintypes.LPCWSTR]
    _k32.CreateJobObjectW.restype = wintypes.HANDLE
    _k32.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD]
    _k32.SetInformationJobObject.restype = wintypes.BOOL
    _k32.QueryInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD,
                                               ctypes.POINTER(wintypes.DWORD)]
    _k32.QueryInformationJobObject.restype = wintypes.BOOL
    _k32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    _k32.AssignProcessToJobObject.restype = wintypes.BOOL
    _k32.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
    _k32.TerminateJobObject.restype = wintypes.BOOL
    _k32.CloseHandle.argtypes = [wintypes.HANDLE]
    _k32.CloseHandle.restype = wintypes.BOOL
    _ntdll.NtResumeProcess.argtypes = [wintypes.HANDLE]
    _ntdll.NtResumeProcess.restype = ctypes.c_long


class JobObjectError(RuntimeError):
    pass


class JobObject:
    """One job per run. Always call close() (or use as a context manager)."""

    def __init__(self, memory_limit_bytes: int, cpu_time_seconds: float, active_processes: int = 1):
        if not IS_WINDOWS:
            raise JobObjectError("Job Objects are only available on Windows")
        self._memory_limit = memory_limit_bytes
        self.handle = _k32.CreateJobObjectW(None, None)
        if not self.handle:
            raise JobObjectError(f"CreateJobObject failed: {ctypes.get_last_error()}")
        info = _EXT_LIMIT()
        b = info.BasicLimitInformation
        b.LimitFlags = (JOB_OBJECT_LIMIT_PROCESS_MEMORY | JOB_OBJECT_LIMIT_ACTIVE_PROCESS
                        | JOB_OBJECT_LIMIT_PROCESS_TIME | JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                        | JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION)
        b.ActiveProcessLimit = active_processes
        b.PerProcessUserTimeLimit = int(cpu_time_seconds * 10_000_000)  # 100-ns units
        info.ProcessMemoryLimit = memory_limit_bytes
        if not _k32.SetInformationJobObject(self.handle, JobObjectExtendedLimitInformation,
                                            ctypes.byref(info), ctypes.sizeof(info)):
            err = ctypes.get_last_error()
            self.close()
            raise JobObjectError(f"SetInformationJobObject(limits) failed: {err}")
        ui = _UI_RESTRICT(JOB_OBJECT_UILIMIT_ALL)
        _k32.SetInformationJobObject(self.handle, JobObjectBasicUIRestrictions, ctypes.byref(ui), ctypes.sizeof(ui))

    def assign(self, process_handle) -> None:
        if not _k32.AssignProcessToJobObject(self.handle, int(process_handle)):
            raise JobObjectError(f"AssignProcessToJobObject failed: {ctypes.get_last_error()}")

    @staticmethod
    def resume(process_handle) -> None:
        status = _ntdll.NtResumeProcess(int(process_handle))
        if status != 0:
            raise JobObjectError(f"NtResumeProcess failed: 0x{status & 0xFFFFFFFF:08x}")

    def terminate(self, exit_code: int = 1) -> None:
        if self.handle:
            _k32.TerminateJobObject(self.handle, exit_code)

    def peak_memory_kb(self) -> int | None:
        if not self.handle:
            return None
        info = _EXT_LIMIT()
        ret = wintypes.DWORD(0)
        if not _k32.QueryInformationJobObject(self.handle, JobObjectExtendedLimitInformation,
                                              ctypes.byref(info), ctypes.sizeof(info), ctypes.byref(ret)):
            return None
        peak = info.PeakProcessMemoryUsed or info.PeakJobMemoryUsed
        return int(peak // 1024) if peak else None

    def close(self) -> None:
        if self.handle:
            _k32.CloseHandle(self.handle)  # KILL_ON_JOB_CLOSE kills anything still running
            self.handle = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
