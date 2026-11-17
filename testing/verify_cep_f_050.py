"""Verification script and test suite for CEP-F-050: View audit events.

Requirement: CEP-F-050
The system shall let an administrator view security audit events, filterable by type and date.
Acceptance Criteria (AC-F-050):
GET /api/admin/audit-events?type=BLOCKED_CODE returns only matching events.

Test Case: TC-ADM-01
Design Specification: DS-ADM-01 (SRS 4.6, SAD 4.1, 4.3)
"""
import os
import shutil
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure backend root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app


def run_verification():
    print("=" * 70)
    print("VERIFICATION SUITE: CEP-F-050 (View Audit Events / TC-ADM-01)")
    print("=" * 70)

    tmp = tempfile.mkdtemp(prefix="cb_adm_verify_")
    try:
        st = Settings()
        st.database_url = "sqlite:///:memory:"
        st.sandbox_root = os.path.join(tmp, "sbx")
        st.jwt_secret = "verify-secret-cep-f-050-super-secret-token-key-32chars"
        st.bcrypt_rounds = 4
        st.exec_timeout_seconds = 1.5
        st.rate_limit_runs_per_min = 1000
        st.admin_username = "admin"
        st.admin_password = "AdminPass1"

        app = create_app(st)
        client = TestClient(app)

        # 1. Authenticate admin and register a standard user (Alice)
        print("[1/7] Setting up admin and standard user (Alice)...")
        r = client.post("/api/auth/login", json={"username": "admin", "password": "AdminPass1"})
        assert r.status_code == 200, f"Admin login failed: {r.text}"
        admin_auth = {"Authorization": "Bearer " + r.json()["access_token"]}

        r = client.post("/api/auth/register", json={"username": "alice", "password": "Passw0rd1"})
        assert r.status_code == 201, f"Alice registration failed: {r.text}"
        r = client.post("/api/auth/login", json={"username": "alice", "password": "Passw0rd1"})
        assert r.status_code == 200, f"Alice login failed: {r.text}"
        alice_auth = {"Authorization": "Bearer " + r.json()["access_token"]}
        print("      PASS: Admin and Alice authenticated.")

        # 2. Trigger multiple distinct security audit events
        print("[2/7] Generating LOGIN_FAILED, BLOCKED_CODE, and TIMEOUT audit events...")
        bad_login = client.post("/api/auth/login", json={"username": "alice", "password": "WrongPassword9"})
        assert bad_login.status_code == 401

        r_blk1 = client.post("/api/executions", json={"code": "import socket"}, headers=alice_auth)
        assert r_blk1.status_code == 200 and r_blk1.json()["status"] == "BLOCKED"

        r_blk2 = client.post("/api/executions", json={"code": "import subprocess"}, headers=alice_auth)
        assert r_blk2.status_code == 200 and r_blk2.json()["status"] == "BLOCKED"

        r_to = client.post("/api/executions", json={"code": "while True: pass"}, headers=alice_auth)
        assert r_to.status_code == 200 and r_to.json()["status"] == "TIMEOUT"
        print("      PASS: Triggered LOGIN_FAILED, 2x BLOCKED_CODE, and TIMEOUT events.")

        # 3. AC-F-050: Filter by type=BLOCKED_CODE
        print("[3/7] Verifying AC-F-050: GET /api/admin/audit-events?type=BLOCKED_CODE...")
        resp = client.get("/api/admin/audit-events?type=BLOCKED_CODE", headers=admin_auth)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        blocked = resp.json()
        assert blocked["total"] == 2, f"Expected 2 BLOCKED_CODE events, got {blocked['total']}"
        assert len(blocked["items"]) == 2
        assert all(e["event_type"] == "BLOCKED_CODE" for e in blocked["items"])
        details = " ".join(e["detail"] for e in blocked["items"])
        assert "socket" in details and "subprocess" in details
        for ev in blocked["items"]:
            assert ev["created_at"] and ev["user_id"] is not None and "ip_address" in ev
        print("      PASS: type=BLOCKED_CODE returned only matching BLOCKED_CODE events.")

        # 4. Verify filtering for other event types and ADMIN_ACCESS self-auditing
        print("[4/7] Verifying TIMEOUT, LOGIN_FAILED, and ADMIN_ACCESS filters...")
        timeouts = client.get("/api/admin/audit-events?type=TIMEOUT", headers=admin_auth).json()
        assert timeouts["total"] == 1 and timeouts["items"][0]["event_type"] == "TIMEOUT"

        failed_logins = client.get("/api/admin/audit-events?type=LOGIN_FAILED", headers=admin_auth).json()
        assert failed_logins["total"] == 1 and failed_logins["items"][0]["event_type"] == "LOGIN_FAILED"
        assert "WrongPassword9" not in failed_logins["items"][0]["detail"]

        all_events = client.get("/api/admin/audit-events?limit=200", headers=admin_auth).json()
        types_seen = {e["event_type"] for e in all_events["items"]}
        assert {"LOGIN_FAILED", "BLOCKED_CODE", "TIMEOUT", "ADMIN_ACCESS"} <= types_seen
        print(f"      PASS: All expected event types queryable: {sorted(types_seen)}.")

        # 5. Date filtering (UTC, naive, and non-UTC timezone offsets)
        print("[5/7] Verifying date range filtering (from/to) with UTC and non-UTC offsets...")
        now_utc = datetime.now(timezone.utc)
        ist = timezone(timedelta(hours=5, minutes=30))

        # Future window -> 0 results
        future = client.get(
            "/api/admin/audit-events",
            params={"from": "2999-01-01T00:00:00"},
            headers=admin_auth,
        ).json()
        assert future["total"] == 0, f"Expected 0 for future from, got {future['total']}"

        # Past upper bound -> 0 results
        past = client.get(
            "/api/admin/audit-events",
            params={"to": "2000-01-01T00:00:00Z"},
            headers=admin_auth,
        ).json()
        assert past["total"] == 0, f"Expected 0 for past to, got {past['total']}"

        # Non-UTC offset (+05:30) covering the generated events -> 2 BLOCKED_CODE events
        from_ist = (now_utc - timedelta(minutes=5)).astimezone(ist).isoformat()
        to_ist = (now_utc + timedelta(minutes=5)).astimezone(ist).isoformat()
        in_window = client.get(
            "/api/admin/audit-events",
            params={"type": "BLOCKED_CODE", "from": from_ist, "to": to_ist},
            headers=admin_auth,
        ).json()
        assert in_window["total"] == 2, f"Expected 2 events in IST window, got {in_window['total']}"
        assert all(e["event_type"] == "BLOCKED_CODE" for e in in_window["items"])
        print("      PASS: Date filtering accurate for naive UTC, Z-UTC, and +05:30 offsets.")

        # 6. Pagination, descending order, and query parameter bounds
        print("[6/7] Verifying pagination, newest-first ordering, and parameter validation...")
        p1 = client.get("/api/admin/audit-events?type=BLOCKED_CODE&limit=1&offset=0", headers=admin_auth).json()
        p2 = client.get("/api/admin/audit-events?type=BLOCKED_CODE&limit=1&offset=1", headers=admin_auth).json()
        assert p1["total"] == 2 and p2["total"] == 2
        assert len(p1["items"]) == 1 and len(p2["items"]) == 1
        assert p1["items"][0]["id"] > p2["items"][0]["id"], "Expected newest-first descending ID order"

        assert client.get("/api/admin/audit-events?limit=0", headers=admin_auth).status_code == 422
        assert client.get("/api/admin/audit-events?limit=201", headers=admin_auth).status_code == 422
        assert client.get("/api/admin/audit-events?offset=-1", headers=admin_auth).status_code == 422
        print("      PASS: Pagination, newest-first ordering, and 422 parameter guards verified.")

        # 7. Access control (403 for non-admin, 401 for unauthenticated)
        print("[7/7] Verifying access control (non-admin -> 403, unauthenticated -> 401)...")
        non_admin = client.get("/api/admin/audit-events", headers=alice_auth)
        assert non_admin.status_code == 403 and non_admin.json()["error"]["code"] == "FORBIDDEN"

        unauth = client.get("/api/admin/audit-events")
        assert unauth.status_code == 401
        print("      PASS: Non-admin blocked (403) and unauthenticated blocked (401).")

        print("=" * 70)
        print("ALL VERIFICATIONS PASSED FOR CEP-F-050 (TC-ADM-01)")
        print("=" * 70)
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
