# Sprint 2 - Day 1 report (15 Nov 2026)

**Owner:** samarthrao2 | **Scope:** issues #20, #56, #54 (8 story points) | **Code verified:** `main` at commit `2a8b8f3`
**Method:** the listed tests were run on Windows 11 / Python 3.11.9 against a fresh checkout of `main` (`pytest -v`), each acceptance criterion was also exercised directly at the shipped default settings, and the code was read. Test run and report prepared with Claude Code assistance.

## Result: 3 of 3 issues verified

| Issue | Requirement | Test case(s) | Result |
|---|---|---|---|
| #20 | CEP-F-018 Rate limit runs | TC-EXE-09 | PASSED |
| #56 | CEP-SR-010 Rate limiting | TC-SEC-10, TC-AUTH-04, TC-EXE-09 | PASSED |
| #54 | CEP-SR-008 CORS / headers | TC-SEC-08 | PASSED |

Command: `pytest tests -v -k "TC_EXE_09 or TC_SEC_10 or TC_AUTH_04 or TC_SEC_08"` -> `4 passed, 100 deselected`. #20 had been closed in bulk on 12 Nov without verification and was reopened by `sirisanikop`; this report is that verification.

## #20 CEP-F-018 - Rate limit runs
- **AC-F-018:** the 11th request within 60 s returns 429 with a `Retry-After` header (limit 10 runs per user per minute).
- **Test evidence:** `test_TC_EXE_09_execution_rate_limit` (limit lowered to 3): runs 1-3 return 200, run 4 returns 429 with `Retry-After >= 1`, and a second user is still allowed (the limit is per user).
- **Direct check at the shipped default (10/min):** runs 1-10 -> 200, **run 11 -> 429**, `Retry-After: 58`, body `{"error": {"code": "RATE_LIMITED", "message": "Too many runs. Retry in 58 s"}}`; a second user's run -> 200.
- **Code:** `backend/app/services/execution_service.py:32-35` (sliding-window check, `RATE_LIMITED` audit event, 429 with `Retry-After`); `backend/app/services/rate_limiter.py:12` (`check`); default in `backend/app/config.py:28` (`RATE_LIMIT_RUNS_PER_MIN`, 10).

## #56 CEP-SR-010 - Rate limiting (login and execution)
- **Requirement:** login and execution endpoints are rate limited per user / IP; excess requests return 429.
- **Test evidence:** `test_TC_SEC_10_rate_limiting_login_and_execution` (limits 2 runs/min, 3 login failures): execution codes `[200, 200, 429]`; login attempts `[401, 401, 401, 429, 429]`. `test_TC_AUTH_04_throttle_after_five_failures`: five wrong passwords return 401, then the sixth attempt returns 429 with `Retry-After` even with the correct password, and 5 `LOGIN_FAILED` plus a `LOGIN_THROTTLED` audit event are recorded. `TC-EXE-09` as above.
- **Direct check at defaults:** login failures 1-7 -> `[401, 401, 401, 401, 401, 429, 429]`; the correct password while locked -> 429.
- **Code:** `backend/app/services/auth_service.py:41-52` (`peek_blocked` before verifying, `record` on failure, `reset` on success, `TOO_MANY_ATTEMPTS` 429 with `Retry-After`); defaults `LOGIN_MAX_FAILURES=5`, `LOGIN_LOCK_MINUTES=5` in `backend/app/config.py:36-37`.
- **Limitation:** counters are kept in memory, so limits are per server process (documented in the SAD).

## #54 CEP-SR-008 - CORS / headers
- **Criterion:** CORS only for the configured front-end origin; standard security headers on responses. (TLS 1.2+ is a deployment requirement and is not testable in this repository.)
- **Test evidence:** `test_TC_SEC_08_cors_and_security_headers`: a preflight from `http://localhost:5173` receives `access-control-allow-origin: http://localhost:5173`; a preflight from `http://evil.example` receives no allow-origin header; `/api/health` carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Cache-Control: no-store`.
- **Direct check:** evil origin -> `None`, configured origin -> `http://localhost:5173`; headers `nosniff`, `DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`.
- **Code:** `backend/app/main.py:52` (`CORSMiddleware`, `allow_origins=[settings.frontend_origin]`, credentials off) and `:61-65` (security headers; `no-store` on `/api` paths); origin from `FRONTEND_ORIGIN` (`backend/app/config.py:43`).

## Notes
- No defects found; no code changed.
- Scope: only the four tests above plus the direct checks; the full suite was not re-run for this report. The Sprint 2 day-by-day plan assigns the remaining issues to later days.
