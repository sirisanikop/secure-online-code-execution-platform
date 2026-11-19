# Sprint 2 - Verification report for #39, #41, and #46 (19 Nov 2026)

**Owner:** suhassiyengar | **Scope:** issues #39, #41, #46 (Non-Functional Requirements) | **Code verified:** `main` at commit `2b8441f`
**Method:** Executed the performance test suite against a live uvicorn server (`backend/tests/test_live_server.py`) and the full sandbox attack suite (`backend/tests/test_sandbox.py`, `backend/tests/test_security.py`) on Windows 11 with Python 3.13.7.

## Result: 3 of 3 issues verified

| Issue | Requirement | Test case(s) | Result |
|---|---|---|---|
| #39 | CEP-NF-001 Response time | TC-PERF-01 | PASSED (p90 = 0.635 s <= 2.0 s) |
| #41 | CEP-NF-003 Attack resistance | TC-SEC-01..10, TC-SBX-01..07 | PASSED (100% controlled, 0 escapes) |
| #46 | CEP-NF-008 Capacity | TC-PERF-03 | PASSED (60 runs from 20 users in 9.7 s) |

Command:
- `pytest backend/tests/test_live_server.py -v -s` -> `4 passed`
- `pytest backend/tests/test_sandbox.py backend/tests/test_security.py -v` -> `75 passed`

---

## #39 CEP-NF-001 - Response time
- **Requirement:** A trivial program (e.g. `print('hi')`) shall return its result within 2 seconds for 90% of requests on the reference machine, excluding queue wait.
- **Acceptance criteria:** 90th percentile of 30 runs <= 2.0 s (Test: `TC-PERF-01`).
- **Measurement:** 30 consecutive execution requests of `print('hi')` against a live server instance:
  - Median ($p50$): **0.582 s**
  - 90th percentile ($p90$): **0.635 s**
  - Max runtime: **0.705 s**
  - All 30 runs returned status `COMPLETED` with HTTP 200.
- **Verdict:** Criterion fully met ($0.635\text{ s} \ll 2.0\text{ s}$).
- **Code:** `backend/tests/test_live_server.py:61-67`.

---

## #41 CEP-NF-003 - Attack resistance
- **Requirement:** No program in the attack test-suite (file read/write, network, process spawn, fork bomb, memory bomb, output flood, import tricks) shall compromise the host or the server process.
- **Acceptance criteria:** 100% of attack cases end in a controlled status and the server remains healthy (Tests: `TC-SEC-01..TC-SEC-10`, `TC-SBX-*`).
- **Measurement:**
  - **Static Policy (`TC-SBX-05`):** 15/15 forbidden patterns blocked at AST inspection time (`import socket`, `import subprocess`, `eval`, `exec`, `open`, `__import__`, `compile`, subclass traversal, lambda globals, reflection, dynamic imports).
  - **Runtime Sandboxing (`TC-SBX-06`):** 28 runtime attack vectors executed inside the Windows Job Object sandbox with PEP 578 audit hooks (including file appends, asyncio subprocesses, builtins patching, directory changing, code object creation, dynamic socket/subprocess/shutil/gc imports, network sockets, filesystem manipulation, and C-extension loading). 100% ended in controlled `RUNTIME_ERROR` or `TIMEOUT` statuses with `DENIED` confirmation and 0 escapes (`ESCAPED` never printed).
  - **Resource Bombs (`TC-SBX-01..04`):** CPU timeouts caught reliably (wall-clock and sleeping programs), memory bombs terminated under Job Object limits without host degradation, output flood capped at byte limit, subprocess spawning blocked.
  - **Clean State (`TC-SBX-07`):** Zero leftover runner processes or temporary directories after multi-iteration hostile executions.
- **Verdict:** Criterion fully met (100% attack containment, zero host compromise).
- **Code:** `backend/tests/test_sandbox.py`, `backend/tests/test_security.py`.

---

## #46 CEP-NF-008 - Capacity
- **Requirement:** A single reference machine (4 cores, 8 GB RAM) shall support 20 concurrent users with 4 simultaneous executions without request failures other than 429/503.
- **Acceptance criteria:** Load test of 20 virtual users (Test: `TC-PERF-03`).
- **Measurement:** 20 concurrent user threads executing 3 code runs each (total 60 executions) against a live server:
  - Total time: **9.7 s** for all 60 executions.
  - Success rate: **60 / 60 (100%)** completed successfully with HTTP 200 and status `COMPLETED`.
  - Request failures: **0** (0 errors, 0 dropped requests).
- **Verdict:** Criterion fully met.
- **Code:** `backend/tests/test_live_server.py:76-92`.
