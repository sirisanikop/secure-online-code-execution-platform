# Sprint 1 - Day 2 report (13 Nov 2026)

**Owner:** samarthrao2 | **Scope:** issue #13 (8 story points) | **Code verified:** `main` at commit `ad4419b` (backend unchanged since `9e0591a`)
**Method:** the listed tests were run on Windows 11 / Python 3.11.9 against a fresh checkout of `main` (`pytest -v`), the acceptance criterion was exercised directly through the sandbox manager, and the code was read. Test run and report prepared with Claude Code assistance.

## Result: 1 of 1 issue verified

| Issue | Requirement | Test case | Result |
|---|---|---|---|
| #13 | CEP-F-011 Isolated execution | TC-EXE-02 (supporting: TC-SEC-01) | PASSED |

Command: `pytest tests/test_execution.py tests/test_security.py -v -k "TC_EXE_02 or TC_SEC_01"` -> `2 passed, 20 deselected`.

Context: #13 had been closed in bulk on 12 Nov without verification and was reopened by `sirisanikop` ("will be closed after its sprint work is verified"). This report is that verification.

## #13 CEP-F-011 - Isolated execution
- **AC-F-011:** `print('hi')` returns stdout `hi`, stderr empty, exit code 0. Requirement: submitted code runs in a separate, isolated operating-system process (never in the server process).
- **Test evidence**
  - `test_TC_EXE_02_isolated_execution_returns_output` asserts `(status, stdout, stderr, exit_code) == ("COMPLETED", "hi\n", "", 0)` through the public API.
  - `test_TC_SEC_01_user_code_runs_in_separate_process` runs `os.getpid()` / `os.getppid()` inside the program and asserts the program's pid differs from the server's pid.
- **Direct check** (sandbox manager on `main`): `print('hi')` -> stdout `'hi\n'`, stderr `''`, exit code `0`, status `COMPLETED`. A program printing its own pids reported program pid 26996 and parent pid 12540, the server's pid: a separate process started by the server.
- **Code**
  - `backend/app/routers/executions.py:14-16` - `POST /api/executions` calls the execution service.
  - `backend/app/services/execution_service.py:37,44` - validates, then calls `self.sandbox.run(...)`.
  - `backend/app/sandbox/manager.py:114-120` - `subprocess.Popen` starts a new `python.exe` with `CREATE_SUSPENDED | CREATE_NO_WINDOW` and assigns it to a Job Object before it runs; `:61` selects the base interpreter (`sys._base_executable`) so no launcher process is created.
  - `backend/app/sandbox/manager.py:142` - the per-run work directory is deleted in the `finally` block.

## Notes
- No defects found; no code changed.
- Limits of this check: only the two tests above were run, not the full 103-test suite. Isolation strength beyond "separate process" (limits, hooks) is covered by other issues (#47 Process isolation, #26 File / network denial, #21 Time limit) and not claimed here.
