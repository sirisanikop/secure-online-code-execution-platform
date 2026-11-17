# Sprint 2 - Day 2 report (17 Nov 2026)

**Owner:** samarthrao2 | **Scope:** issues #40, #42, #37 | **Code verified:** `main` at commit `04b4aa2`
**Method:** the listed tests were run on Windows 11 / Python 3.11.9 (4 cores) in a fresh clone of `main`, and each acceptance criterion was also exercised against a live uvicorn server. Test run and report prepared with Claude Code assistance.
**Note on scope:** issues #18 and #15 (planned for this day) were completed and reported by `sirisanikop` (Sprint 2 Day 4 report), by team decision, and are not repeated here.

## Result: 3 of 3 issues verified

| Issue | Requirement | Test case(s) | Result |
|---|---|---|---|
| #40 | CEP-NF-002 Sandbox overhead | TC-PERF-02 | PASSED |
| #42 | CEP-NF-004 Resilience | TC-REL-01, TC-SBX-07 | PASSED |
| #37 | CEP-F-051 Platform statistics | TC-ADM-02 | PASSED |

Command: `pytest tests -v -k "TC_PERF_02 or TC_REL_01 or TC_SBX_07 or TC_ADM_02"` -> `4 passed, 100 deselected` (55 s).

## #40 CEP-NF-002 - Sandbox overhead
- **Criterion:** mean time of empty-program runs <= 500 ms.
- **Direct check:** 30 runs of `pass`, all COMPLETED; mean **164 ms**, median 156 ms, max 212 ms (`runtime_ms` reported by the API).
- **Code/test:** `backend/tests/test_live_server.py:69` (15 runs against a real server).

## #42 CEP-NF-004 - Resilience
- **Criterion:** health answers within 1 s while hostile programs run; no orphan processes after 100 mixed runs.
- **Direct check:** 100 mixed runs from 4 and from 8 concurrent clients, with expected statuses (for example COMPLETED 12, RUNTIME_ERROR 25, TIMEOUT 25, MEMORY_LIMIT 13, OUTPUT_LIMIT 13, BLOCKED 12). `/api/health` probed from a separate `curl` process throughout: **max 44 ms** over 234 probes (4 clients) and **29 ms** over 171 probes (8 clients), all HTTP 200. Sandbox runner processes after = baseline; leftover `run_*` directories = 0.
- **Measurement correction:** a first probe, running inside the same Python process as the load generator, showed latencies up to 2.3 s. That was contention in the test client (8 busy threads on 4 cores), not server latency; the separate-process probe is the valid measurement.
- **Tests:** `test_TC_REL_01_...` (4 hostile clients) and `test_TC_SBX_07_...` pass.

## #37 CEP-F-051 - Platform statistics
- **AC-F-051:** the statistics endpoint returns counts consistent with the database.
- **Direct check (130 runs, 10 users):** `/api/admin/stats` returned `total_runs` 130, `runs_by_status` {BLOCKED 12, COMPLETED 42, MEMORY_LIMIT 13, OUTPUT_LIMIT 13, RUNTIME_ERROR 25, TIMEOUT 25} and `total_users` 10; the same counts read directly from the SQLite `executions` and `users` tables were identical.
- **Not independently checked:** `avg_runtime_ms`, `active_users_24h`, `queue_waiting` beyond the unit test.

## Notes
- No defects found; no code changed.
- A CodeBox server not started by this run was already listening on port 8000 and one runner-matching process existed before and after; it was unchanged and is excluded from the orphan count (baseline comparison).
- Results are from one laptop; timings will differ on other hardware.
