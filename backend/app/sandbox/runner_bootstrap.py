"""Bootstrap executed INSIDE the sandboxed child process (DS-SBX-02).

Started as:  python -I -S -B -u -X utf8 runner_bootstrap.py <path-to-main.py>

Order of operations
  1. read + compile the user's program (before any restriction is active)
  2. pre-import modules the traceback printer needs
  3. install a PEP 578 audit hook (cannot be removed once installed) that denies
     network, process creation, ctypes, out-of-sandbox file access and every file write,
     and an import guard for blocked modules
  4. run the program in a fresh ``__main__`` module

The hook is a closure that binds every builtin it needs as a local, so user code that
monkey-patches ``builtins`` cannot alter its behaviour.
"""
import sys


_PRELOAD = ("inspect", "dataclasses", "typing", "enum", "functools", "collections", "re", "threading", "weakref", "pathlib")


def _build_hook(roots, workdir):
    import os

    # ---- everything the hook uses is bound here, never looked up through builtins ----
    isinstance_, str_, int_, bytes_ = isinstance, str, int, bytes
    PermissionError_, Exception_ = PermissionError, Exception
    abspath, normcase, fsdecode, sep = os.path.abspath, os.path.normcase, os.fsdecode, os.sep
    write_flags = (os.O_WRONLY | os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_TRUNC
                   | getattr(os, "O_EXCL", 0) | getattr(os, "O_TEMPORARY", 0))
    roots = tuple(normcase(abspath(r)) for r in roots)
    devices = frozenset(("con", "prn", "aux", "nul", "conin$", "conout$", "clock$"))

    deny_prefix = ("socket.", "subprocess.", "ctypes.", "_winapi.", "msvcrt.", "winreg.", "shutil.", "tempfile.",
                   "pty.", "webbrowser.", "urllib.", "http.", "ftplib.", "smtplib.", "telnetlib.", "sqlite3.",
                   "mmap.", "multiprocessing.", "signal.", "resource.", "fcntl.", "winsound.")
    deny_exact = frozenset((
        "os.system", "os.exec", "os.spawn", "os.posix_spawn", "os.fork", "os.forkpty", "os.startfile",
        "os.remove", "os.rename", "os.replace", "os.mkdir", "os.rmdir", "os.chmod", "os.chown", "os.lchown",
        "os.link", "os.symlink", "os.truncate", "os.utime", "os.putenv", "os.unsetenv", "os.add_dll_directory",
        "os.kill", "os.killpg", "os.chdir", "os.chroot", "os.mkfifo", "os.mknod",
        "code.__new__", "sys.settrace", "sys.setprofile",
    ))
    path_events = frozenset(("os.listdir", "os.scandir"))
    blocked_modules = frozenset((
        "subprocess", "socket", "_socket", "ssl", "_ssl", "http", "urllib", "ftplib", "smtplib", "poplib", "imaplib",
        "telnetlib", "xmlrpc", "socketserver", "requests", "ctypes", "_ctypes", "cffi", "multiprocessing",
        "_multiprocessing", "signal", "shutil", "tempfile", "glob", "sqlite3", "_sqlite3", "pickle", "_pickle",
        "marshal", "shelve", "dbm", "importlib", "runpy", "code", "codeop", "pty", "fcntl", "mmap", "resource",
        "webbrowser", "gc", "_winapi", "msvcrt", "winreg", "_winreg", "winsound", "pdb", "bdb", "trace",
        "cProfile", "profile", "asyncio", "ensurepip", "venv",
    ))
    state = [False]  # re-entrancy guard: events raised by the hook itself are ignored

    def inside(p):
        try:
            if isinstance_(p, bytes_):
                p = fsdecode(p)
            full = normcase(abspath(p))
        except Exception_:
            return False
        # Windows special cases: reserved device names (CON, NUL, COM1...) and alternate data streams
        base = full.rpartition(sep)[2].partition(".")[0].partition(":")[0].rstrip(" ")
        if base in devices or (len(base) == 4 and base[:3] in ("com", "lpt") and base[3] in "123456789"):
            return False
        if ":" in full[2:]:
            return False
        for r in roots:
            if full == r or full.startswith(r + sep):
                return True
        return False

    def hook(event, args):
        if state[0]:
            return
        state[0] = True
        try:
            if event == "open":
                path, mode, flags = args[0], args[1], args[2]
                if isinstance_(path, int_):
                    return  # an already-open descriptor (stdin/stdout/stderr)
                if isinstance_(mode, str_) and ("w" in mode or "a" in mode or "x" in mode or "+" in mode):
                    raise PermissionError_("Sandbox policy: writing files is not permitted")
                if isinstance_(flags, int_) and flags & write_flags:
                    raise PermissionError_("Sandbox policy: writing files is not permitted")
                if not inside(path):
                    raise PermissionError_("Sandbox policy: access to '" + str_(path) + "' is not permitted")
                return
            if event == "import":
                name = args[0]
                if isinstance_(name, str_) and name.partition(".")[0] in blocked_modules:
                    raise PermissionError_("Sandbox policy: importing '" + name + "' is not permitted")
                return
            if event in path_events:
                p = args[0] if args else None
                if p is None:
                    p = "."
                if not isinstance_(p, int_) and not inside(p):
                    raise PermissionError_("Sandbox policy: listing '" + str_(p) + "' is not permitted")
                return
            if event in deny_exact or event.startswith(deny_prefix):
                raise PermissionError_("Sandbox policy: '" + event + "' is not permitted")
        finally:
            state[0] = False

    return hook, blocked_modules


def main():
    import os
    import linecache
    import traceback
    import types

    path = sys.argv[1]
    workdir = os.path.dirname(os.path.abspath(path))
    with open(path, "rb") as f:
        raw = f.read()
    text = raw.decode("utf-8", "replace")
    # serve source lines for tracebacks from memory (no file access needed later)
    linecache.cache["main.py"] = (len(text), None, text.splitlines(True), "main.py")

    try:
        code = compile(raw, "main.py", "exec")
    except SyntaxError as e:
        sys.stderr.write("".join(traceback.format_exception_only(type(e), e)))
        sys.exit(1)

    # Pre-load commonly used standard-library modules while restrictions are not yet active, so that their
    # own internal imports (e.g. dataclasses -> inspect -> importlib) never hit the import guard later.
    import importlib
    for name in _PRELOAD:
        try:
            importlib.import_module(name)
        except Exception:  # noqa: BLE001 - a missing optional module must not stop the run
            pass

    roots = [workdir, sys.base_prefix, sys.exec_prefix, sys.base_exec_prefix]
    hook, blocked = _build_hook(roots, workdir)
    for name in blocked:               # make already-loaded blocked modules importable only via the guard
        sys.modules.pop(name, None)
    sys.addaudithook(hook)

    mod = types.ModuleType("__main__")
    mod.__file__ = "main.py"
    sys.modules["__main__"] = mod
    sys.argv = ["main.py"]
    try:
        exec(code, mod.__dict__)
    except SystemExit:
        raise
    except BaseException as e:  # noqa: BLE001 - report like the interpreter would, minus our own frame
        frames = [f for f in traceback.extract_tb(e.__traceback__) if not f.filename.endswith("runner_bootstrap.py")]
        out = ["Traceback (most recent call last):\n"] if frames else []
        out += traceback.format_list(frames)
        out += traceback.format_exception_only(type(e), e)
        sys.stderr.write("".join(out))
        sys.stderr.flush()
        sys.exit(1)


main()
