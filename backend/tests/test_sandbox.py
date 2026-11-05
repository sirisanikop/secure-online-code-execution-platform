"""TC-SBX-*: resource limits, static policy, runtime denial, cleanup (CEP-F-020..026)."""
import os
import subprocess
import time

import pytest

from app.sandbox.manager import Limits, SandboxManager
from app.services.validator import validate
from tests.conftest import run

LIMITS = Limits(5, 128, 65536)


@pytest.fixture()
def sandbox(tmpdir_path):
    return SandboxManager(os.path.join(tmpdir_path, "sbx"), max_concurrent=4, max_queue=20)


def leftover_runners() -> int:
    cmd = "(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*runner_boot'+'strap*' } | Measure-Object).Count"
    out = subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True, text=True).stdout
    return int(out.strip() or 0)


def test_TC_SBX_01_time_limit(sandbox):
    t = time.perf_counter()
    r = sandbox.run("while True: pass", "", LIMITS)
    assert r.status == "TIMEOUT" and time.perf_counter() - t < 5.8


def test_TC_SBX_01b_sleeping_program_also_times_out(sandbox):
    r = sandbox.run("import time\ntime.sleep(60)", "", LIMITS)
    assert r.status == "TIMEOUT" and r.runtime_ms < 5800


def test_TC_SBX_02_memory_limit(sandbox):
    for code in ("x = [0] * 10**9", "s = 'a'\nwhile True: s += s", "b = bytearray(500 * 1024 * 1024)"):
        r = sandbox.run(code, "", LIMITS)
        assert r.status == "MEMORY_LIMIT", (code, r.status, r.stderr)


def test_TC_SBX_03_output_cap(sandbox):
    r = sandbox.run("while True: print('a' * 1000)", "", LIMITS)
    assert r.status == "OUTPUT_LIMIT" and len(r.stdout.encode()) <= 65536
    r = sandbox.run("import sys\nwhile True: sys.stderr.write('e' * 1000)", "", LIMITS)
    assert r.status == "OUTPUT_LIMIT"


def test_TC_SBX_04_no_child_processes(sandbox, tmpdir_path):
    marker = os.path.join(tmpdir_path, "spawned.txt").replace("\\", "\\\\")
    attempts = [
        f"import os\nos.system('echo x > {marker}')",
        f"import os\nos.spawnl(os.P_WAIT, 'C:\\\\Windows\\\\System32\\\\cmd.exe', 'cmd', '/c', 'echo x > {marker}')",
        f"import subprocess\nsubprocess.run('echo x > {marker}', shell=True)",
        f"import os\nos.popen('echo x > {marker}')",
        f"_w = __import__('_winapi')\n_w.CreateProcess(None, 'cmd /c echo x > {marker}', None, None, False, 0, None, None, None)",
        "import os\nwhile True: os.spawnl(os.P_NOWAIT, 'C:\\\\Windows\\\\System32\\\\cmd.exe', 'cmd', '/c', 'pause')",  # fork-bomb style
    ]
    for code in attempts:
        r = sandbox.run(code, "", LIMITS)
        assert r.status in ("RUNTIME_ERROR", "TIMEOUT", "MEMORY_LIMIT", "OUTPUT_LIMIT"), (code, r.status)
        assert "Sandbox policy" in r.stderr or r.status != "COMPLETED"
    time.sleep(0.5)
    assert not os.path.exists(os.path.join(tmpdir_path, "spawned.txt"))


@pytest.mark.parametrize("code,rule", [
    ("import socket", "import"), ("import subprocess", "import"), ("from os import system\nimport ctypes", "import"),
    ("import urllib.request", "import"), ("eval('1+1')", "builtin"), ("exec('x=1')", "builtin"),
    ("open('f.txt')", "builtin"), ("__import__('os')", "builtin"), ("compile('1','f','eval')", "builtin"),
    ("().__class__.__base__.__subclasses__()", "attribute"), ("f = lambda: 0\nf.__globals__", "attribute"),
    ("getattr(int, '__subclasses__')", "reflection"), ("import importlib", "import"), ("import gc", "import"),
    ("from . import x", "import"),
])
def test_TC_SBX_05_static_policy_blocks(client, auth, code, rule):
    v = validate(code)
    assert not v.ok and v.rule == rule and v.reason.startswith("Line ")
    r = run(client, auth, code)
    assert r["status"] == "BLOCKED" and r["exit_code"] is None and r["runtime_ms"] == 0 and r["blocked_reason"]


def test_TC_SBX_05b_allowed_programs_pass_policy():
    ok = ["import math, random, json, re\nprint(math.sqrt(4))", "from dataclasses import dataclass\n@dataclass\nclass A:\n  x: int",
          "import os\nprint(os.getcwd())", "class A:\n  pass\nprint(A().__class__.__name__)", "print(print)", "x = input()"]
    assert all(validate(c).ok for c in ok)
    assert validate("print(").ok  # syntax errors are reported by the interpreter, not by the policy


# attacks that get past the static check (or bypass it entirely) must be stopped at runtime
RUNTIME_ATTACKS = {
    "read_windows_file": "print(open(r'C:\\Windows\\win.ini').read())" ,
    "read_traversal": "print(open('..\\\\..\\\\..\\\\..\\\\..\\\\Windows\\\\win.ini').read())",
    "read_pipe": "open(r'\\\\.\\pipe\\x')",
    "write_file": "open('x.txt', 'w').write('1')",
    "append_file": "open('main.py', 'a').write('#')",
    "exclusive_create": "open('y.txt', 'x')",
    "os_open_write": "import os\nos.open('z.txt', os.O_WRONLY | os.O_CREAT)",
    "listdir_root": "import os\nprint(os.listdir('C:\\\\'))",
    "scandir_users": "import os\nlist(os.scandir('C:\\\\Users'))",
    "walk_root": "import os\nnext(os.walk('C:\\\\'))",
    "remove_own": "import os\nos.remove('main.py')",
    "mkdir": "import os\nos.mkdir('d')",
    "rename": "import os\nos.rename('main.py', 'm2.py')",
    "symlink": "import os\nos.symlink('main.py', 'l')",
    "chdir": "import os\nos.chdir('C:\\\\')",
    "putenv": "import os\nos.environ['A'] = '1'",
    "system": "import os\nos.system('echo x')",
    "startfile": "import os\nos.startfile('notepad.exe')",
    "dyn_import_socket": "m = 'soc' + 'ket'\n__import__(m)",
    "sys_modules_import": "import sys\nsys.modules['x'] = None\nimport socket",
    "dyn_import_subprocess": "__import__('sub' + 'process')",
    "dyn_import_ctypes": "__import__('ctypes')",
    "dyn_import_gc": "__import__('gc')",
    "dyn_import_importlib": "__import__('importlib')",
    "dyn_import_shutil": "__import__('shutil')",
    "winreg": "__import__('winreg')",
    "msvcrt": "__import__('msvcrt')",
    "sqlite_file": "__import__('sqlite3').connect('db.sqlite')",
    "gadget_system": ("w = [c for c in ().__class__.__base__.__subclasses__() if c.__name__ == 'catch_warnings'][0]\n"
                      "w()._module.__builtins__['__import__']('os').system('echo x')"),
    "gadget_import_socket": ("w = [c for c in ().__class__.__base__.__subclasses__() if c.__name__ == 'catch_warnings'][0]\n"
                             "w()._module.__builtins__['__import__']('socket')"),
    "eval_import": "eval('__import__(\"socket\")')",
    "exec_open": "exec('open(\"x.txt\", \"w\")')",
    "builtins_patch_then_read": ("import builtins\nbuiltins.isinstance = lambda *a: False\nbuiltins.str = None\n"
                                 "open(r'C:\\Windows\\win.ini').read()"),
    "load_ctypes_pyd": ("import inspect, sys, os\nm = inspect.importlib.machinery\n"
                        "p = os.path.join(sys.base_prefix, 'DLLs', '_ctypes.pyd')\n"
                        "spec = m.ModuleSpec('_ctypes', m.ExtensionFileLoader('_ctypes', p), origin=p)\n"
                        "mod = spec.loader.create_module(spec)\nmod.LoadLibrary('kernel32')"),
    "code_object": "import types\ntypes.CodeType(0, 0, 0, 0, 0, 0, b'', (), (), (), 'f', 'f', 'f', 1, b'', b'')",
    "settrace": "import sys\nsys.settrace(lambda *a: None)",
    "http": "__import__('http.client')",
    "mmap": "__import__('mmap')",
    "pickle": "__import__('pickle')",
    "asyncio_subprocess": "__import__('asyncio')",
}


@pytest.mark.parametrize("name", sorted(RUNTIME_ATTACKS))
def test_TC_SBX_06_runtime_denial(sandbox, name):
    """Each program tries a forbidden operation; it must fail inside the sandbox (never complete normally)."""
    code = "try:\n" + "\n".join("    " + ln for ln in RUNTIME_ATTACKS[name].splitlines()) + \
           "\n    print('ESCAPED')\nexcept BaseException as e:\n    print('DENIED', type(e).__name__)\n    raise\n"
    r = sandbox.run(code, "", LIMITS)
    assert "ESCAPED" not in r.stdout, f"{name}: {r.stdout!r} {r.stderr!r}"
    assert r.status in ("RUNTIME_ERROR", "TIMEOUT"), (name, r.status, r.stderr)
    assert "DENIED" in r.stdout, (name, r.stdout, r.stderr)


def test_TC_SBX_06b_allowed_operations_still_work(sandbox):
    code = ("import os, sys, math, random, json, re, collections, itertools, datetime, time, heapq, string\n"
            "from dataclasses import dataclass\nfrom fractions import Fraction\nimport threading, queue\n"
            "print(open('main.py').read()[:6])\n"        # reading the program itself is allowed
            "print(os.getcwd() != '', math.pi > 3, json.dumps([1]), Fraction(1, 3))\n"
            "t = threading.Thread(target=lambda: print('thread ok')); t.start(); t.join()\n"
            "import pathlib; print(pathlib.PurePath('a/b').name)\n")
    r = sandbox.run(code, "", LIMITS)
    assert r.status == "COMPLETED", r.stderr
    assert "import" in r.stdout and "thread ok" in r.stdout and "1/3" in r.stdout


def test_TC_SBX_07_cleanup_no_orphans_no_temp_dirs(sandbox):
    before = leftover_runners()
    programs = ["print(1)", "1/0", "while True: pass", "x=[0]*10**9", "while True: print('a'*999)",
                "import time\ntime.sleep(30)", "import threading, time\nthreading.Thread(target=time.sleep, args=(60,)).start()\nprint('x')",
                "import os\nos.system('x')"]
    for i in range(24):
        sandbox.run(programs[i % len(programs)], "", Limits(2, 128, 65536))
    time.sleep(0.5)
    assert list(sandbox.root.glob("run_*")) == []
    assert leftover_runners() == before == 0
