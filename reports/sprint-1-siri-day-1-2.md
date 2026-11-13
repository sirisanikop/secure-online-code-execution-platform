# Sprint 1 - Day 1 and Day 2 report: sirisanikop

**Scope:** Day 1: #7, #17, #19. Day 2: #22, #51 (16 story points in total).
**Code verified:** `main` at commit `ad4419b`. No code was changed; this PR only adds this report.
**Method:** each acceptance criterion was compared with the code and the matching test case. The backend sandbox needs Windows Job Objects, so the tests were **not run locally**. The evidence is the passing **Backend tests (Windows)** job in the GitHub Actions run on PR #6 (https://github.com/sirisanikop/secure-online-code-execution-platform/actions/runs/43180510634) plus code review.

## Result: 5 of 5 issues verified

| Day | Issue | Requirement | Test case | Result |
|---|---|---|---|---|
| 1 | #7 | CEP-F-001 Register account | TC-AUTH-01, TC-AUTH-06 | PASSED |
| 1 | #17 | CEP-F-015 Capture errors | TC-EXE-06 | PASSED |
| 1 | #19 | CEP-F-017 Fresh workdir per run | TC-EXE-08 | PASSED |
| 2 | #22 | CEP-F-021 Memory limit | TC-SBX-02 | PASSED |
| 2 | #51 | CEP-SR-005 Input validation | TC-SEC-05 | PASSED |

## #7 CEP-F-001 - Register account
- **AC-F-001:** valid details create the account (201); duplicate or invalid details are rejected (409/422).
- **Code:** `backend/app/routers/auth.py:12` (`POST /register`, status 201); `backend/app/schemas.py:10` (`RegisterIn`: username and password validators); `backend/app/services/auth_service.py:23` (`register()`: lower-cased username, duplicate check raises 409 `USERNAME_TAKEN`, password stored as a bcrypt hash).
- **Tests:** `TC-AUTH-01`, `TC-AUTH-06` in `backend/tests/test_auth.py`.

## #17 CEP-F-015 - Capture errors
- **AC-F-015:** a program raising ZeroDivisionError returns a non-zero exit code and the traceback text.
- **Code:** `backend/app/sandbox/manager.py:202` (stderr captured and runner frames stripped), `:204` (exit code), `:222` (non-zero exit classified `RUNTIME_ERROR`).
- **Test:** `test_TC_EXE_06_exceptions_and_syntax_errors_captured` in `backend/tests/test_execution.py`.

## #19 CEP-F-017 - Fresh workdir per run
- **AC-F-017:** a file written in run N is absent in run N+1; the directory no longer exists after the run.
- **Code:** `backend/app/sandbox/manager.py:104` (`mkdtemp(prefix="run_")` per run), `:141-142` (`rmtree` in `finally`), `:87` (`sweep_stale()` removes leftovers after a crash).
- **Test:** `test_TC_EXE_08_fresh_workdir_per_run_and_deleted` in `backend/tests/test_execution.py`.

## #22 CEP-F-021 - Memory limit
- **AC-F-021:** allocating a 500 MB list is killed and reported as MEMORY_LIMIT; the server stays healthy.
- **Code:** `backend/app/config.py:22` (`exec_memory_limit_mb`, default 128); `backend/app/sandbox/job_object.py:101-106` (Job Object with `JOB_OBJECT_LIMIT_PROCESS_MEMORY`, `ProcessMemoryLimit` set at `:106`); `backend/app/sandbox/manager.py:215-217` (`MemoryError` in stderr or peak memory >= 90% of the limit gives `MEMORY_LIMIT`). The program runs in a child process, so the server is not affected.
- **Test:** `test_TC_SBX_02_memory_limit` in `backend/tests/test_sandbox.py` runs three programs (a huge list, a doubling string, a 500 MB bytearray) and asserts `MEMORY_LIMIT` for each.

## #51 CEP-SR-005 - Input validation
- **AC:** SQL-injection strings and oversize bodies are rejected or stored inertly.
- **Code:** `backend/app/schemas.py:10` (`RegisterIn` rejects an injection username with 422); `backend/app/routers/executions.py:18` (`limit` is an integer `Query(20, ge=1, le=100)`, so `1 OR 1=1` gives 422); `backend/app/services/auth_service.py:25,46` (SQLAlchemy `select()` with bound parameters); `backend/app/main.py:22,58` (bodies over 1,000,000 bytes get 413) and `backend/app/services/execution_service.py:25-28` (code over 50 KB or stdin over 16 KB gets 413).
- **Test:** `test_TC_SEC_05_input_validation_and_sql_injection` in `backend/tests/test_security.py` (injection login and register, `limit=1 OR 1=1`, malformed JSON, wrong types, a 1.5 MB body, and a final check that the tables still exist).

## Corrections to the earlier issue comments
Two line references in the comments posted on #22 and #51 were off: the 128 MB setting is `backend/app/config.py:22` (not `:27`), and the `limit` parameter validation is `backend/app/routers/executions.py:18` (not `:15`). The results are unchanged.
