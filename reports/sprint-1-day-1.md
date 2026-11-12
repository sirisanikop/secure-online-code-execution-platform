# Sprint 1 - Day 1 report (12 Nov 2026)

**Owner:** samarthrao2 | **Scope:** issues #9, #11, #52 (7 story points) | **Code verified:** `main` at commit `9e0591a`
**Method:** the listed tests were run on Windows 11 / Python 3.11.9 against a fresh checkout of `main` (`pytest -v`), and each acceptance criterion was compared with the code. Test run and report prepared with Claude Code assistance.

## Result: 3 of 3 issues verified

| Issue | Requirement | Test case | Result |
|---|---|---|---|
| #9 | CEP-F-003 Login / issue JWT | TC-AUTH-03 | PASSED |
| #11 | CEP-F-005 Token required | TC-AUTH-05 | PASSED |
| #52 | CEP-SR-006 Clean environment | TC-SEC-06 | PASSED |

Command: `pytest tests/test_auth.py tests/test_security.py -v -k "TC_AUTH_03 or TC_AUTH_05 or TC_SEC_06"` -> `3 passed, 15 deselected`.

## #9 CEP-F-003 - Login / issue JWT
- **AC-F-003:** correct credentials return 200 and a token; the token is rejected after expiry.
- **Evidence:** `test_TC_AUTH_03_login_issues_signed_expiring_token` checks status 200, `token_type == "bearer"`, `expires_in == 3600`, that the token decodes with the server secret (HS256) with `exp - iat` close to 3600 s, and that an already-expired token gets 401 from `/api/auth/me`.
- **Code:** `backend/app/security.py:19` (`create_token`), `:28` (`decode_token`: algorithm pinned to HS256, `exp` and `sub` required); lifetime from `backend/app/config.py:34` (`JWT_EXPIRE_MINUTES`, default 60).

## #11 CEP-F-005 - Token required
- **AC-F-005:** missing, malformed, expired or tampered tokens return 401.
- **Evidence:** `test_TC_AUTH_05_token_required_on_protected_endpoints` calls five protected endpoints without a token (all 401), with `Bearer garbage` (401) and with a tampered signature (401), and confirms a valid token gets 200.
- **Code:** `backend/app/deps.py:29` (`NOT_AUTHENTICATED` when no bearer token), `:33-36` (any `PyJWTError`, bad subject or unknown user gives `INVALID_TOKEN`, 401).

## #52 CEP-SR-006 - Clean environment
- **Criterion:** a program printing its environment shows no JWT secret or DB path (only an allow-listed set of variables).
- **Evidence:** `test_TC_SEC_06_child_environment_has_no_server_secrets` sets `JWT_SECRET` in the server environment, runs a program that prints `os.environ`, and asserts the secret value, the name `JWT_SECRET`, the admin password, `codebox.db` and `DATABASE_URL` are all absent, and that the variable names are a subset of `SYSTEMROOT, TEMP, TMP, PYTHONDONTWRITEBYTECODE`.
- **Code:** `backend/app/sandbox/manager.py:109-112` builds the child environment explicitly from those four variables instead of inheriting the server's.

## Notes
- No defects found today; no code changed.
- Not covered by today's scope: the full 103-test suite was not re-run, only the three tests above.
