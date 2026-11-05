"""TC-EXE-*: submission, status classification, stdin, errors, queue, cleanup, rate limit."""
import os
import threading
import time

import pytest

from app.sandbox.manager import Limits, SandboxBusy, SandboxManager
from tests.conftest import register_login, run


def test_TC_EXE_01_accepts_code_and_stdin_within_limits(client, auth):
    r = run(client, auth, "print('ok')", "some input")
    assert r["status"] == "COMPLETED"


def test_TC_EXE_02_isolated_execution_returns_output(client, auth):
    r = run(client, auth, "print('hi')")
    assert (r["status"], r["stdout"], r["stderr"], r["exit_code"]) == ("COMPLETED", "hi\n", "", 0)


def test_TC_EXE_03_status_classification(client, auth):
    cases = {
        "COMPLETED": "print(1)",
        "RUNTIME_ERROR": "raise ValueError('x')",
        "TIMEOUT": "while True: pass",
        "MEMORY_LIMIT": "x = [0] * 10**9",
        "OUTPUT_LIMIT": "while True: print('a' * 1000)",
        "BLOCKED": "import socket",
    }
    for expected, code in cases.items():
        assert run(client, auth, code)["status"] == expected, code


def test_TC_EXE_04_reports_runtime_and_memory(client, auth):
    r = run(client, auth, "print(sum(range(100000)))")
    assert r["runtime_ms"] > 0 and r["peak_mem_kb"] and r["peak_mem_kb"] > 1000


def test_TC_EXE_05_stdin_delivered_and_eof(client, auth):
    r = run(client, auth, "a = input()\nb = input()\nprint(a + '|' + b)", "one\ntwo\n")
    assert r["stdout"] == "one|two\n"
    r = run(client, auth, "input()\ninput()", "only-one\n")
    assert r["status"] == "RUNTIME_ERROR" and "EOFError" in r["stderr"]


def test_TC_EXE_06_exceptions_and_syntax_errors_captured(client, auth):
    r = run(client, auth, "print('before')\n1/0")
    assert r["status"] == "RUNTIME_ERROR" and r["exit_code"] != 0
    assert "ZeroDivisionError" in r["stderr"] and 'File "main.py", line 2' in r["stderr"] and r["stdout"] == "before\n"
    r = run(client, auth, "print(")
    assert r["status"] == "RUNTIME_ERROR" and "SyntaxError" in r["stderr"]
    # no server paths may leak through tracebacks
    for text in (r["stderr"], run(client, auth, "import os\nos.system('x')")["stderr"]):
        assert "runner_bootstrap" not in text and "Desktop" not in text and "backend" not in text


def test_TC_EXE_07_concurrency_limit_and_queue(tmpdir_path):
    mgr = SandboxManager(os.path.join(tmpdir_path, "q"), max_concurrent=2, max_queue=2)
    limits = Limits(5, 128, 65536)
    results, errors = [], []

    def worker():
        try:
            results.append(mgr.run("import time\ntime.sleep(1.5)\nprint('done')", "", limits))
        except SandboxBusy:
            errors.append("busy")

    threads = [threading.Thread(target=worker) for _ in range(4)]  # 2 running + 2 queued
    for t in threads:
        t.start()
        time.sleep(0.15)
    time.sleep(0.3)
    assert mgr.waiting == 2
    with pytest.raises(SandboxBusy):  # 5th request: queue (2) is full
        mgr.run("print(1)", "", limits)
    for t in threads:
        t.join()
    assert not errors and len(results) == 4 and all(r.status == "COMPLETED" for r in results)


def test_TC_EXE_07b_api_returns_503_when_queue_full(make_client):
    c = make_client(max_concurrent_runs=1, max_queue_length=0)
    h = register_login(c)
    t = threading.Thread(target=lambda: c.post("/api/executions", json={"code": "import time\ntime.sleep(2)"}, headers=h))
    t.start()
    time.sleep(0.8)
    r = c.post("/api/executions", json={"code": "print(1)"}, headers=h)
    t.join()
    assert r.status_code == 503 and r.json()["error"]["code"] == "SERVER_BUSY"


def test_TC_EXE_08_fresh_workdir_per_run_and_deleted(client, auth):
    r1 = run(client, auth, "import os\nprint(os.getcwd())\nprint(sorted(os.listdir('.')))")
    cwd = r1["stdout"].splitlines()[0]
    assert "['main.py']" in r1["stdout"]
    assert not os.path.exists(cwd)
    r2 = run(client, auth, "import os\nprint(os.getcwd())")
    assert r2["stdout"].splitlines()[0] != cwd


def test_TC_EXE_09_execution_rate_limit(make_client):
    c = make_client(rate_limit_runs_per_min=3)
    h = register_login(c)
    for _ in range(3):
        assert c.post("/api/executions", json={"code": "print(1)"}, headers=h).status_code == 200
    r = c.post("/api/executions", json={"code": "print(1)"}, headers=h)
    assert r.status_code == 429 and int(r.headers["Retry-After"]) >= 1
    other = register_login(c, "second", "Passw0rd1")  # limit is per user
    assert c.post("/api/executions", json={"code": "print(1)"}, headers=other).status_code == 200


def test_TC_EXE_10_oversize_inputs_rejected(client, auth):
    big = "x = 1\n" * 20000  # > 50 KB
    r = client.post("/api/executions", json={"code": big}, headers=auth)
    assert r.status_code == 413 and r.json()["error"]["code"] == "CODE_TOO_LARGE"
    r = client.post("/api/executions", json={"code": "print(1)", "stdin": "a" * 20000}, headers=auth)
    assert r.status_code == 413 and r.json()["error"]["code"] == "STDIN_TOO_LARGE"
    r = client.post("/api/executions", json={"code": "#" * 2_000_000}, headers=auth)
    assert r.status_code == 413
    assert client.post("/api/executions", json={"code": "   "}, headers=auth).status_code == 422
