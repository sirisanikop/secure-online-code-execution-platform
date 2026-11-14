# Day 2 Issue Verification Notes — #47 and #49

**Date:** 13 November 2026  
**Repository:** `secure-online-code-execution-platform`  
**Working branch:** `testing-upload`

This document records a source-level inspection of the existing implementation for the two issues assigned for Day 2. It does not claim that the Windows-only sandbox was executed successfully on macOS, and it does not claim that either issue has been independently accepted or closed.

## Issue #47 — Process Isolation

### Relevant implementation

- `backend/app/sandbox/manager.py`
- `backend/app/sandbox/job_object.py`
- `backend/app/sandbox/runner_bootstrap.py`

### What the current code does

1. `SandboxManager.run()` checks the host platform and returns `INTERNAL_ERROR` when it is not Windows, because this implementation depends on Windows Job Objects.
2. It creates a temporary working directory and writes the submitted program to `main.py`.
3. It creates a `JobObject` with the configured memory limit and a CPU-time backstop.
4. It starts the base Python interpreter with `CREATE_SUSPENDED` and `CREATE_NO_WINDOW` flags.
5. It assigns the suspended process handle to the Job Object before resuming execution.
6. The Job Object configures process-memory, active-process, CPU-time, kill-on-close and unhandled-exception limits. It also applies Windows UI restrictions.
7. The manager supervises execution and, in its `finally` block, terminates/closes the job, waits for or kills the process, closes its streams and removes the temporary directory.

### Related verification coverage in the repository

- `backend/tests/test_security.py::test_TC_SEC_01_user_code_runs_in_separate_process` checks that the executed program has a PID different from the API process.
- `backend/tests/test_sandbox.py` contains sandbox-specific tests for execution and lifecycle behaviour.

### Platform note

The Job Object implementation is Windows-specific. On macOS, `SandboxManager.run()` intentionally returns `INTERNAL_ERROR` before launching the child process. Therefore, a successful end-to-end process-isolation run must be verified on a supported Windows environment. This source inspection is not a substitute for that run.

## Issue #49 — Token Security

### Relevant implementation

- `backend/app/security.py`
- `backend/app/deps.py`
- `backend/app/config.py`
- `backend/app/routers/auth.py`

### What the current code does

1. `create_token()` creates a JWT with `sub`, `username`, `adm`, `iat` and `exp` claims.
2. Tokens are signed using HS256.
3. The token lifetime is configurable through `JWT_EXPIRE_MINUTES` and defaults to 60 minutes.
4. `decode_token()` explicitly permits only HS256 and requires both `exp` and `sub` claims.
5. `get_current_user()` accepts Bearer credentials, verifies the token, converts `sub` to a user ID and loads the user from the database. Missing, malformed, expired or invalid tokens are rejected with HTTP 401.
6. Administrator access is checked against the user's database record in `require_admin()`; the token's `adm` claim is not used as the source of authorization.
7. `JWT_SECRET` can be supplied through the environment. If it is absent, the application generates a random secret and logs a startup warning; tokens signed with that fallback secret will not remain valid across application restarts.

### Related verification coverage in the repository

- `backend/tests/test_auth.py::test_TC_AUTH_03_login_issues_signed_expiring_token` checks token signing and the configured expiry.
- `backend/tests/test_auth.py::test_TC_AUTH_05_token_required_on_protected_endpoints` checks missing, invalid and tampered tokens on protected endpoints.
- `backend/tests/test_security.py::test_TC_SEC_03_token_forgery_rejected` checks wrong-secret, `alg: none`, missing-expiry, unknown-user and invalid-subject tokens, and verifies that a forged admin claim does not grant admin access.

## Inspection outcome

The uploaded project source already contains implementations and corresponding tests for both areas. No unrelated source files were changed as part of this verification note.

**Verification status:** source inspected. Windows-only process-isolation execution was not run on macOS. A local attempt to run the token tests was blocked during test setup because the Python environment available for this extracted ZIP does not have `bcrypt` installed; the bundled `.venv` is a Windows-style environment and has no macOS `bin/python`. The existing automated tests are identified above but are not reported as newly passing here.
