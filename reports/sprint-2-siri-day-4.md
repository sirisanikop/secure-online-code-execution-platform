# Sprint 2 - Day 4 report: sirisanikop

**Scope:** the Day 4 list (#64, #44, #30) plus #15 and #18.
**Evidence base:** the passing "Backend tests (Windows)" job on `main` at f99e9a7 (https://github.com/sirisanikop/secure-online-code-execution-platform/actions/runs/43898103028). The files checked for #15 and #18 are unchanged since that run.

## Result

| Issue | Requirement | Test case | Result |
|---|---|---|---|
| #30 | CEP-F-032 Owner-only detail | TC-HIS-03 | PASSED (closed 15 Nov; also in PR #76) |
| #44 | CEP-NF-006 Portability | TC-MNT-01 | PASSED by Samarth on Windows 11 (fresh clone, 104 backend and 8 frontend tests); see caveat below |
| #64 | DEL-08 Stop tracking node_modules and frontend/dist | n/a | **Open: branch ready, waiting for team OK** |
| #15 | CEP-F-013 Runtime / memory stats | TC-EXE-04 | PASSED |
| #18 | CEP-F-016 Concurrency + queue | TC-EXE-07, 07b | PASSED (scaled-limits caveat) |

## #15 CEP-F-013 - Runtime / memory stats
- **AC-F-013:** completed runs return `runtime_ms` and `peak_mem_kb` greater than 0.
- **Code:** `backend/app/sandbox/manager.py:184,196,199,223`; `backend/app/sandbox/job_object.py:129-137`; `backend/app/schemas.py:71-72`; `backend/app/services/execution_service.py:56-57`.
- **Test:** `test_TC_EXE_04_reports_runtime_and_memory` (`backend/tests/test_execution.py:35-37`) asserts `runtime_ms > 0` and `peak_mem_kb > 1000`.
- **Note:** the schema allows `peak_mem_kb` to be null if the Job Object query fails; the test covers the normal path.

## #18 CEP-F-016 - Concurrency + queue
- **AC-F-016:** with 4 long jobs running, 20 requests queue and the 25th receives 503.
- **Code:** `backend/app/config.py:26-27` (defaults 4 and 20); `backend/app/sandbox/manager.py:69-81` (`_acquire()`); `backend/app/services/execution_service.py:45-46` (503 `SERVER_BUSY`, `Retry-After: 5`).
- **Tests:** `test_TC_EXE_07_concurrency_limit_and_queue` (`backend/tests/test_execution.py:58-79`) and `test_TC_EXE_07b_api_returns_503_when_queue_full` (`:82-90`).
- **Caveat:** the tests use scaled-down limits (2 running, 2 queued). The exact 4 + 20 + 25th scenario was not run; the code path is the same with the configured numbers.

## #64 and the #44 caveat
Samarth's #44 comment notes that `npm install` said "up to date" because `frontend/node_modules` is tracked in Git. That means his walkthrough did not exercise a real dependency install. Merging branch `sprint-2-untrack-build-artifacts` (#64) removes that shortcut: after it merges, `npm install` must download everything. CI already does a clean `npm ci` and `npm run build` on every push, so the risk is low, but the walkthrough should be repeated once after #64 merges. #64 stays open until the team agrees and the branch is merged.
