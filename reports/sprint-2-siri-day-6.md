# Sprint 2, Day 6: Siri's issue verification

Date: 17 Nov 2026

## #55 CEP-SR-009 Audit logging (TC-SEC-09, TC-OPS-01)

**Criteria:** audit rows exist for each event class (login failure, blocked code, limit breach, admin access) and contain no secrets.

**Code**
- `backend/app/services/audit.py`: event types and `log()`. Stores event type, user id, detail (max 500 characters) and IP. It never stores passwords, tokens or source code.
- `backend/app/services/auth_service.py:43,50`: LOGIN_THROTTLED and LOGIN_FAILED. Detail is `username=<first 30 characters>` only.
- `backend/app/services/execution_service.py:34,41,48`: RATE_LIMITED, BLOCKED_CODE (rule and reason only), limit events (event type and `runtime_ms`).
- `backend/app/routers/admin.py:28,37`: ADMIN_ACCESS.
- `backend/app/main.py:46` and `backend/app/config.py:44`: purge at start-up, default 90 days.

**Tests** (`backend/tests/test_security.py`)
- TC-SEC-09 (`:110-122`): after a failed login, `import subprocess`, a 10**9 allocation and an admin read, asserts LOGIN_FAILED, BLOCKED_CODE, MEMORY_LIMIT and ADMIN_ACCESS exist, and that neither test password nor the `eyJ` token prefix appears in any audit detail.
- TC-OPS-01 (`:131-145`): an event older than retention is purged at start-up and a fresh one is kept.

**Evidence:** not run locally, because the backend needs Windows. Based on the passing "Backend tests (Windows)" job on main 04b4aa2:
https://github.com/sirisanikop/secure-online-code-execution-platform/actions/runs/43904593893

**Limitation:** TC-SEC-09 does not assert TIMEOUT, OUTPUT_LIMIT, RATE_LIMITED or LOGIN_THROTTLED. Those are covered by code review only.

**Result:** PASSED. Issue #55 closed.
