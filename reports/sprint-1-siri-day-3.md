# Sprint 1 - Day 3 report: sirisanikop

**Scope:** #25 (verified), #57 (demo video, not done yet). #17 is also on the Day 3 plan but was already verified and closed on Day 1 (see `sprint-1-siri-day-1-2.md`).
**Code verified:** `main` at commit `92ab562`. No code was changed; this PR only adds this report.

## Result

| Issue | Requirement | Test case | Result |
|---|---|---|---|
| #25 | CEP-F-024 Static policy check | TC-SBX-05, TC-SBX-05b | PASSED |
| #17 | CEP-F-015 Capture errors | TC-EXE-06 | Already PASSED and closed on Day 1 |
| #57 | DEL-01 Sprint 1 demo video (1 min) | n/a | **Not done**: video still to be recorded and uploaded to `docs/videos/` |

## #25 CEP-F-024 - Static policy check
- **AC-F-024:** `import socket` and `eval(...)` return BLOCKED naming the rule; the code is never started.
- **Local run:** `validate()` from `backend/app/services/validator.py` was run directly on all 15 TC-SBX-05 inputs. All 15 were rejected with the expected rule (`import`, `builtin`, `attribute`, `reflection`) and a "Line N:" reason. The 6 allowed programs of TC-SBX-05b passed, and a syntax error is passed through to the interpreter.
- **CI run:** the API half of the test (`status == BLOCKED`, `exit_code is None`, `runtime_ms == 0`) needs the full backend stack and rests on the passing "Backend tests (Windows)" job on `main`: https://github.com/sirisanikop/secure-online-code-execution-platform/actions/runs/43461291787
- **Code:** `backend/app/services/validator.py:9-25` (blocklists) and `:40-73` (`validate()`); `backend/app/services/execution_service.py:37-41` (failed verdict returns BLOCKED and writes an audit event); `self.sandbox.run()` is only reached in the `else` branch (`:43-44`), so blocked code never starts.
- **Test:** `backend/tests/test_sandbox.py:63-87`.

## #57 DEL-01 - Sprint 1 demo video
Not done in this PR. The 1-minute video of the working product must be recorded by a team member and added under `docs/videos/` in a separate PR. #57 stays open until then.
