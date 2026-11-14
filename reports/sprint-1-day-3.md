# Sprint 1 - Day 3 report (14 Nov 2026)

**Owner:** samarthrao2 | **Scope:** issues #23, #27 (8 story points) + one defect fix found during an end-to-end check | **Code verified:** `main` at commit `92ab562` (without the fix below)
**Method:** the listed tests were run on Windows 11 / Python 3.11.9 against a fresh checkout of `main` (`pytest -v`), each acceptance criterion was also exercised directly through the sandbox manager, and the code was read. Test run and report prepared with Claude Code assistance.

## Result: 2 of 2 issues verified

| Issue | Requirement | Test case | Result |
|---|---|---|---|
| #23 | CEP-F-022 Output cap | TC-SBX-03 | PASSED |
| #27 | CEP-F-026 Cleanup | TC-SBX-07 | PASSED |

Command: `pytest tests/test_sandbox.py -v -k "TC_SBX_03 or TC_SBX_07"` -> `2 passed, 61 deselected`. Issues #23 and #27 had been closed in bulk on 12 Nov without verification and were reopened by `sirisanikop`; this report is that verification.

## #23 CEP-F-022 - Output cap
- **AC-F-022:** an infinite print loop is stopped; the response is at most 64 KB per stream.
- **Test evidence:** `test_TC_SBX_03_output_cap` runs `while True: print('a' * 1000)` and asserts status `OUTPUT_LIMIT` and `len(stdout) <= 65536`; it repeats the check with an infinite stderr writer and asserts `OUTPUT_LIMIT`.
- **Direct check:** stdout flood -> status `OUTPUT_LIMIT`, stdout 65,471 bytes (limit 65,536), stopped after 250 ms. stderr flood -> status `OUTPUT_LIMIT`.
- **Observation (not a failure):** the returned stderr in the stderr-flood case was 65,587 bytes: the program's own output is capped at 65,536 bytes, and the platform appends a short notice line (`[output exceeded 65536 bytes - program terminated]`, about 51 bytes). A strict "at most 64 KB including the notice" reading would need the notice counted inside the cap. Not changed here.
- **Code:** `backend/app/sandbox/manager.py` reader threads count bytes per stream, keep at most `cap` bytes, and on overflow set the `exceeded` flag and terminate the Job Object; the status is mapped to `OUTPUT_LIMIT` when that flag is set.

## #27 CEP-F-026 - Cleanup
- **AC-F-026:** after 100 mixed runs no `python.exe` child and no temp directory remains.
- **Test evidence:** `test_TC_SBX_07_cleanup_no_orphans_no_temp_dirs` runs 24 mixed runs (success, error, infinite loop, memory bomb, output flood, sleep, a background thread, blocked `os.system`) and asserts no `run_*` directory and no sandbox runner process remains.
- **Direct check at the criterion's size (100 runs):** 100 mixed runs in 57 s -> `COMPLETED 12, RUNTIME_ERROR 24, TIMEOUT 39, MEMORY_LIMIT 13, OUTPUT_LIMIT 12`. Runner processes before: 0, after: 0. Leftover `run_*` temp directories: 0.
- **Code:** `backend/app/sandbox/manager.py` - the `finally` block terminates the job, closes the pipes and handles, deletes the work directory and releases the worker slot; the Job Object is created with kill-on-close, and `sweep_stale()` removes leftovers from a previous crash at start-up.

## Defect found and fixed during the end-to-end check (not part of #23 / #27)
- **Symptom:** on a fresh `git clone` of `main`, following the run instructions, the server crashed at start-up with `sqlite3.OperationalError: unable to open database file`.
- **Cause:** `backend/data/` (where the SQLite file lives) is gitignored, so it does not exist after a clone, and the application never created it. It worked on the development machine only because the folder already existed. The earlier clean-install check used an in-memory database and missed it.
- **Fix:** `backend/app/database.py` creates the database file's parent folder before connecting (file databases only).
- **Regression test:** `backend/tests/test_database.py` - fails on the previous code, passes with the fix.
- **Verified:** with the fix, a fresh clone of `main` starts, serves the built UI, registers and logs in a user, runs a normal program (`COMPLETED`), a blocked program (`BLOCKED`) and a memory bomb (`MEMORY_LIMIT`), and shows admin statistics. The quick suite (auth, execution, history/admin, security, database: 37 tests) passes on the fixed code.

## Notes
- Scope of the checks: only the tests named above plus the direct checks described; the full 103-test suite was not re-run for this report.
- Limits, hooks and file/network denial belong to other issues (#21, #26, #47) and are not claimed here.
