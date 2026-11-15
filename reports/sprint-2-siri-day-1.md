# Sprint 2 - Day 1 report: sirisanikop

**Scope:** #30, #44, #64. Also closes out Sprint 1: #63.
**Code checked:** `main` at commit `2a8b8f3` (all three CI jobs green).

## Result

| Issue | Requirement | Test case | Result |
|---|---|---|---|
| #63 | DEL-07 Extend CI | n/a | DONE (PR #6 merged; 3 jobs green on `main`) |
| #30 | CEP-F-032 Owner-only detail | TC-HIS-03 | PASSED |
| #44 | CEP-NF-006 Portability | TC-MNT-01 | **Partly verified, still open** (clean-machine walkthrough not done) |
| #64 | DEL-08 Stop tracking node_modules and frontend/dist | n/a | **Change prepared on a branch, waiting for team OK** |

## #30 CEP-F-032 - Owner-only detail
- **AC-F-032:** user B requesting user A's execution id receives 404.
- **Code:** `backend/app/routers/executions.py:30-34` (`_owned()` raises 404 NOT_FOUND when the row is missing or `row.user_id != user.id`, the same answer for both) and `:37-39` (`GET /{exec_id}` uses it).
- **Test:** `test_TC_HIS_03_other_users_get_404` in `backend/tests/test_history_admin.py:29-36`: user B gets 404 on GET and DELETE of A's run, sees an empty list, A's run is untouched, and a missing id also gives 404.
- **Evidence:** not run locally (the backend stack is not installed in this environment). It rests on the passing "Backend tests (Windows)" job on `main`: https://github.com/sirisanikop/secure-online-code-execution-platform/actions/runs/43621484856

## #44 CEP-NF-006 - Portability (not closed)
- **AC:** a clean machine follows `HOW_TO_RUN.md` and reaches a working app (TC-MNT-01).
- **Checked (document against repo):** every path the guide uses exists (`backend/run.py`, `backend/requirements.txt`, `testing/run_all.ps1`, `testing/README.md`, `backend/app/create_admin.py`); the `npm run build` / `npm test` / `npm run dev` scripts exist in `frontend/package.json`; the environment variables it lists (EXEC_TIMEOUT_SECONDS, EXEC_MEMORY_LIMIT_MB, EXEC_OUTPUT_LIMIT_BYTES, MAX_CODE_BYTES, MAX_STDIN_BYTES, MAX_CONCURRENT_RUNS, MAX_QUEUE_LENGTH, RATE_LIMIT_RUNS_PER_MIN, LOGIN_MAX_FAILURES, LOGIN_LOCK_MINUTES, JWT_SECRET, JWT_EXPIRE_MINUTES, FRONTEND_ORIGIN, SANDBOX_ROOT, SANDBOX_PYTHON, HOST, PORT) are read in `backend/app/config.py` or `backend/run.py`.
- **Not done:** the actual walkthrough on a clean Windows 10/11 machine, because the sandbox only runs on Windows. Someone must follow the guide step by step on a machine that has never run the project, and record the result. #44 stays open until then.

## #64 DEL-08 - Stop tracking node_modules and frontend/dist
- **Change (branch `sprint-2-untrack-build-artifacts`):** adds a `.gitignore` (the file was empty) and removes 5,532 `frontend/node_modules` files and 3 `frontend/dist` files from Git tracking. Local copies are not deleted. Nothing else changes (354 tracked files remain).
- **Why it is safe:** `HOW_TO_RUN.md` section 2.2 already tells users to run `npm install` and `npm run build`, and the CI "Frontend tests" job already runs `npm ci` and `npm run build` on a clean checkout.
- **Team impact:** after this merges, a teammate who pulls will have those folders removed from their working copy and must run `npm install` and `npm run build` once. The issue says to get team confirmation first, so this PR should not be merged until everyone has agreed.
