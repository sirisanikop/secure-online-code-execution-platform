# Sprint 2 - Verification report for #36 and #45 (17 Nov 2026)

**Owner:** suhassiyengar | **Scope:** issues #36, #45 (5 story points) | **Code verified:** `main` at commit `04b4aa2` + timezone fix on `sprint-2/audit-events-and-retention`
**Method:** ran the pytest suites (`test_history_admin.py`, `test_security.py`) on Windows / Python 3.13.7, executed dedicated standalone verification scripts (`testing/verify_cep_f_050.py` and `testing/verify_cep_nf_007.py`), and reviewed the admin/audit backend code.

## Result: 2 of 2 issues verified (1 defect found and fixed)

| Issue | Requirement | Test case(s) | Result |
|---|---|---|---|
| #36 | CEP-F-050 View audit events | TC-ADM-01 | PASSED (after timezone normalization fix) |
| #45 | CEP-NF-007 Audit retention | TC-OPS-01 | PASSED |

Commands:
- `python testing/verify_cep_f_050.py` -> `ALL VERIFICATIONS PASSED FOR CEP-F-050 (TC-ADM-01)` (7/7 checks)
- `python testing/verify_cep_nf_007.py` -> `ALL VERIFICATIONS PASSED FOR CEP-NF-007 (TC-OPS-01)` (6/6 checks)
- `python -m pytest backend/tests/test_history_admin.py backend/tests/test_security.py -v` -> `20 passed`

## #36 CEP-F-050 - View audit events
- **AC-F-050:** `GET /api/admin/audit-events?type=BLOCKED_CODE` returns only matching events; filterable by type and date (`from`, `to`).
- **Defect found & fixed:** In `backend/app/routers/admin.py:22-25`, `date_from.replace(tzinfo=date_from.tzinfo or timezone.utc)` kept non-UTC offsets (e.g., `+05:30`) without converting them to UTC. Because SQLite stores UTC timestamps without an offset, querying with a non-UTC ISO-8601 offset compared local wall-clock time against UTC and missed matching events (`total == 0` instead of `1`). Fixed by converting timezone-aware inputs with `.astimezone(timezone.utc)` before querying.
- **Test evidence:**
  - `test_TC_ADM_01_audit_events_filter`: `type=BLOCKED_CODE` returns only `BLOCKED_CODE` with `socket` in `detail`; `type=TIMEOUT` returns only `TIMEOUT`; `from=2999-01-01T00:00:00` returns 0.
  - `test_TC_ADM_01_audit_events_date_range_and_timezone` (added): verifies combined `type` + `from` + `to` filtering with `+05:30` timezone offsets.
  - `testing/verify_cep_f_050.py`: verifies `type=BLOCKED_CODE`, `TIMEOUT`, `LOGIN_FAILED`, `ADMIN_ACCESS` self-auditing, UTC/naive/IST date bounds, newest-first pagination, `422` parameter bounds, and `403`/`401` access control.
- **Code:** `backend/app/routers/admin.py:15-31`, `backend/app/schemas.py:95-107`, `frontend/src/pages/AdminPage.jsx:28-41`.

## #45 CEP-NF-007 - Audit retention
- **Requirement:** All security-relevant events shall be stored with timestamp, user, IP and type, and retained for at least 90 days (configurable); failed login, blocked code and limit breaches are queryable.
- **Test evidence:**
  - `test_TC_OPS_01_audit_retention_and_query`: 100-day-old event is purged on startup while fresh event is retained under 90-day policy.
  - `test_TC_OPS_01_configurable_retention_and_security_fields` (added): verifies `AUDIT_RETENTION_DAYS` defaults to 90, honors env override (`120`), retains 89d/100d events and purges 125d under 120-day policy, then retains 89d and purges 100d under 90-day policy, and confirms queryable fields via `/api/admin/audit-events`.
  - `test_TC_SEC_09_security_events_audited_without_secrets`: verifies no passwords or JWT tokens leak into audit details.
  - `testing/verify_cep_nf_007.py`: triggers and queries all 8 event types (`LOGIN_FAILED`, `LOGIN_THROTTLED`, `BLOCKED_CODE`, `TIMEOUT`, `MEMORY_LIMIT`, `OUTPUT_LIMIT`, `RATE_LIMITED`, `ADMIN_ACCESS`), verifies timestamp/user/IP/type fields and secret redaction, and tests startup purge across 120-day and 90-day policies.
- **Code:** `backend/app/services/audit.py:9-29`, `backend/app/config.py:44` (`AUDIT_RETENTION_DAYS`, default `90`), `backend/app/main.py:46` (`audit.purge_old` on startup), `backend/app/models.py:46-54`.
