"""TC-PERF-*, TC-REL-01: performance and resilience against a real uvicorn server process."""
import os
import socket
import statistics
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import httpx
import pytest

from tests.test_sandbox import leftover_runners

BACKEND = Path(__file__).resolve().parent.parent


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def server():
    tmp = tempfile.mkdtemp(prefix="cblive_")
    port = _free_port()
    env = {**os.environ, "PORT": str(port), "JWT_SECRET": "live-secret-live-secret-live-secret-1234",
           "DATABASE_URL": f"sqlite:///{Path(tmp, 'live.db').as_posix()}", "SANDBOX_ROOT": os.path.join(tmp, "sbx"),
           "RATE_LIMIT_RUNS_PER_MIN": "1000", "BCRYPT_ROUNDS": "4", "ADMIN_USERNAME": "", "ADMIN_PASSWORD": ""}
    proc = subprocess.Popen([sys.executable, "run.py"], cwd=BACKEND, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://127.0.0.1:{port}"
    for _ in range(100):
        try:
            if httpx.get(base + "/api/health", timeout=1).status_code == 200:
                break
        except httpx.HTTPError:
            time.sleep(0.2)
    else:
        proc.kill()
        pytest.fail("server did not start")
    yield base
    proc.terminate()
    proc.wait(timeout=10)


def _login(base, name):
    httpx.post(base + "/api/auth/register", json={"username": name, "password": "Passw0rd1"}, timeout=10)
    tok = httpx.post(base + "/api/auth/login", json={"username": name, "password": "Passw0rd1"}, timeout=10).json()["access_token"]
    return {"Authorization": "Bearer " + tok}


def _run(base, h, code, timeout=60):
    t = time.perf_counter()
    r = httpx.post(base + "/api/executions", json={"code": code}, headers=h, timeout=timeout)
    return r, (time.perf_counter() - t)


def test_TC_PERF_01_trivial_program_p90_under_2s(server):
    h = _login(server, "perf1")
    times = sorted(_run(server, h, "print('hi')")[1] for _ in range(30))
    p90 = times[int(len(times) * 0.9) - 1]
    print(f"p50={statistics.median(times):.3f}s p90={p90:.3f}s max={times[-1]:.3f}s")
    assert p90 <= 2.0


def test_TC_PERF_02_sandbox_overhead_under_500ms(server):
    h = _login(server, "perf2")
    ms = [_run(server, h, "pass")[0].json()["runtime_ms"] for _ in range(15)]
    print(f"mean sandbox time for an empty program: {statistics.mean(ms):.0f} ms")
    assert statistics.mean(ms) <= 500


def test_TC_PERF_03_twenty_concurrent_users(server):
    results = []

    def user(i):
        h = _login(server, f"load{i}")
        for n in range(3):
            r, _ = _run(server, h, f"print({i} * {n})")
            results.append((r.status_code, r.json().get("status")))

    threads = [threading.Thread(target=user, args=(i,)) for i in range(20)]
    t = time.perf_counter()
    [x.start() for x in threads]
    [x.join() for x in threads]
    print(f"60 runs from 20 users in {time.perf_counter() - t:.1f}s")
    assert len(results) == 60
    assert all(code in (200, 429, 503) for code, _ in results)
    assert sum(1 for code, st in results if code == 200 and st == "COMPLETED") >= 54  # >=90% succeed


def test_TC_REL_01_server_responsive_under_hostile_load_and_no_orphans(server):
    hostile = ["while True: pass", "x = [0] * 10**9", "while True: print('a' * 999)", "import time\ntime.sleep(60)"]
    hs = [_login(server, f"evil{i}") for i in range(4)]
    out = []
    threads = [threading.Thread(target=lambda h=h, c=c: out.append(_run(server, h, c)[0].json()["status"])) for h, c in zip(hs, hostile)]
    [t.start() for t in threads]
    time.sleep(1.0)
    worst = 0.0
    for _ in range(8):
        t = time.perf_counter()
        assert httpx.get(server + "/api/health", timeout=3).status_code == 200
        worst = max(worst, time.perf_counter() - t)
        time.sleep(0.4)
    [t.join() for t in threads]
    print(f"worst health latency under attack: {worst * 1000:.0f} ms")
    assert worst <= 1.0
    assert sorted(out) == ["MEMORY_LIMIT", "OUTPUT_LIMIT", "TIMEOUT", "TIMEOUT"]
    time.sleep(0.5)
    assert leftover_runners() == 0
