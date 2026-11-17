"""Verification script and test suite for CEP-NF-007: Audit retention.

Requirement: CEP-NF-007
All security-relevant events shall be stored with timestamp, user, IP and type,
and retained for at least 90 days (configurable).
Acceptance Criteria:
Events for failed login, blocked code and limit breaches are queryable.

Test Case: TC-OPS-01
Design Specification: DS-AUD-01 (SRS 5, SAD 4.1, 4.3)
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
from sqlalchemy import select
from app.config import Settings
from app.main import create_app
from app.models import AuditEvent
from app.services import audit


def run_verification():
    print("=" * 70)
    print("VERIFICATION SUITE: CEP-NF-007 (Audit Retention & Query / TC-OPS-01)")
    print("=" * 70)

    tmp = tempfile.mkdtemp(prefix="cb_ops_verify_")
    old_env = os.environ.get("AUDIT_RETENTION_DAYS")
    try:
        # 1. Verify default 90-day retention and env-var configurability
        print("[1/6] Verifying AUDIT_RETENTION_DAYS default (90) and configurability...")
        os.environ.pop("AUDIT_RETENTION_DAYS", None)
        assert Settings().audit_retention_days == 90, "Default retention must be 90 days"
        os.environ["AUDIT_RETENTION_DAYS"] = "180"
        assert Settings().audit_retention_days == 180, "AUDIT_RETENTION_DAYS env override failed"
        os.environ.pop("AUDIT_RETENTION_DAYS", None)
        print("      PASS: Default is 90 days and AUDIT_RETENTION_DAYS env var overrides cleanly.")

        db_path = Path(tmp, "audit_retention.db").as_posix()
        db_url = f"sqlite:///{db_path}"

        def make_cfg(retention_days=90, rate_limit=1000, login_max=5):
            st = Settings()
            st.database_url = db_url
            st.sandbox_root = os.path.join(tmp, "sbx")
            st.jwt_secret = "verify-secret-cep-nf-007-super-secret-token-key-32chars"
            st.bcrypt_rounds = 4
            st.exec_timeout_seconds = 1.5
            st.exec_memory_limit_mb = 128
            st.exec_output_limit_bytes = 4096
            st.rate_limit_runs_per_min = rate_limit
            st.login_max_failures = login_max
            st.audit_retention_days = retention_days
            st.admin_username = "admin"
            st.admin_password = "AdminPass1"
            return st

        app = create_app(make_cfg(retention_days=90, rate_limit=4, login_max=2))
        client = TestClient(app)

        # 2. Setup admin & standard user Alice
        print("[2/6] Authenticating admin and registering standard user (Alice)...")
        r = client.post("/api/auth/login", json={"username": "admin", "password": "AdminPass1"})
        assert r.status_code == 200
        admin_auth = {"Authorization": "Bearer " + r.json()["access_token"]}

        r = client.post("/api/auth/register", json={"username": "alice", "password": "Passw0rd1"})
        assert r.status_code == 201
        alice_id = r.json()["id"]
        r = client.post("/api/auth/login", json={"username": "alice", "password": "Passw0rd1"})
        assert r.status_code == 200
        alice_auth = {"Authorization": "Bearer " + r.json()["access_token"]}
        print(f"      PASS: Admin authenticated; Alice created with user_id={alice_id}.")

        # 3. Trigger all security-relevant events: failed login, throttle, blocked code, limit breaches
        print("[3/6] Generating failed login, throttle, blocked code, and limit breach events...")
        # Failed logins + throttle
        assert client.post("/api/auth/login", json={"username": "alice", "password": "BadPassword1"}).status_code == 401
        assert client.post("/api/auth/login", json={"username": "alice", "password": "BadPassword2"}).status_code == 401
        assert client.post("/api/auth/login", json={"username": "alice", "password": "BadPassword3"}).status_code == 429

        # Blocked code + 3 sandbox limit breaches (4 runs total == rate_limit=4)
        assert client.post("/api/executions", json={"code": "import socket"}, headers=alice_auth).json()["status"] == "BLOCKED"
        assert client.post("/api/executions", json={"code": "while True: pass"}, headers=alice_auth).json()["status"] == "TIMEOUT"
        assert client.post("/api/executions", json={"code": "x = [0] * 10**9"}, headers=alice_auth).json()["status"] == "MEMORY_LIMIT"
        assert client.post("/api/executions", json={"code": "while True: print('A' * 500)"}, headers=alice_auth).json()["status"] == "OUTPUT_LIMIT"
        # 5th run triggers execution RATE_LIMITED
        assert client.post("/api/executions", json={"code": "print('rate limited')"}, headers=alice_auth).status_code == 429
        print("      PASS: Triggered all 7 user-facing security event types.")

        # 4. Query all events via admin endpoint and verify fields + no secret leakage
        print("[4/6] Querying audit events and verifying timestamp, user, IP, type, and redaction...")
        # First admin call also logs ADMIN_ACCESS
        client.get("/api/admin/audit-events?limit=1", headers=admin_auth)
        res = client.get("/api/admin/audit-events?limit=200", headers=admin_auth).json()
        events = res["items"]
        seen_types = {e["event_type"] for e in events}
        expected_types = {
            "LOGIN_FAILED",
            "LOGIN_THROTTLED",
            "BLOCKED_CODE",
            "TIMEOUT",
            "MEMORY_LIMIT",
            "OUTPUT_LIMIT",
            "RATE_LIMITED",
            "ADMIN_ACCESS",
        }
        assert expected_types <= seen_types, f"Missing event types: {expected_types - seen_types}"

        for ev in events:
            assert ev["created_at"], f"Missing timestamp on event {ev}"
            assert ev["event_type"] in audit.EVENT_TYPES
            assert isinstance(ev["ip_address"], str) and len(ev["ip_address"]) > 0, f"Missing IP on event {ev}"
            if ev["event_type"] in {"BLOCKED_CODE", "TIMEOUT", "MEMORY_LIMIT", "OUTPUT_LIMIT", "RATE_LIMITED"}:
                assert ev["user_id"] == alice_id, f"Expected user_id={alice_id} on {ev}"

        blob = " ".join(e["detail"] for e in events)
        for secret in ("BadPassword1", "BadPassword2", "BadPassword3", "Passw0rd1", "AdminPass1", "eyJ"):
            assert secret not in blob, f"Secret leaked into audit detail: {secret}"
        print(f"      PASS: All {len(expected_types)} event types queryable with timestamp, user, IP, type; no secrets leaked.")

        # 5. Seed historical events at 89d, 100d, and 125d and verify configurable retention (120d -> 90d)
        print("[5/6] Verifying 120-day custom retention window on restart...")
        now = datetime.now(timezone.utc)
        with app.state.session_factory() as db:
            db.add_all([
                AuditEvent(event_type=audit.LOGIN_FAILED, user_id=alice_id, detail="hist_89d",
                           ip_address="198.51.100.1", created_at=now - timedelta(days=89)),
                AuditEvent(event_type=audit.BLOCKED_CODE, user_id=alice_id, detail="hist_100d",
                           ip_address="198.51.100.2", created_at=now - timedelta(days=100)),
                AuditEvent(event_type=audit.TIMEOUT, user_id=alice_id, detail="hist_125d",
                           ip_address="198.51.100.3", created_at=now - timedelta(days=125)),
            ])
            db.commit()

        app_120 = create_app(make_cfg(retention_days=120))
        with app_120.state.session_factory() as db:
            details_120 = {e.detail for e in db.scalars(select(AuditEvent)).all()}
        assert "hist_89d" in details_120, "89-day event must be retained under 120-day policy"
        assert "hist_100d" in details_120, "100-day event must be retained under 120-day policy"
        assert "hist_125d" not in details_120, "125-day event must be purged under 120-day policy"
        print("      PASS: Under 120-day retention, 89d & 100d retained, 125d purged.")

        # 6. Restart under default 90-day retention and verify 89d retained, 100d purged
        print("[6/6] Verifying default 90-day retention window on restart...")
        app_90 = create_app(make_cfg(retention_days=90))
        with app_90.state.session_factory() as db:
            details_90 = {e.detail for e in db.scalars(select(AuditEvent)).all()}
        assert "hist_89d" in details_90, "89-day event must be retained under 90-day policy"
        assert "hist_100d" not in details_90, "100-day event must be purged under 90-day policy"
        print("      PASS: Under 90-day retention, 89d retained and 100d purged.")

        print("=" * 70)
        print("ALL VERIFICATIONS PASSED FOR CEP-NF-007 (TC-OPS-01)")
        print("=" * 70)
        return True
    finally:
        if old_env is None:
            os.environ.pop("AUDIT_RETENTION_DAYS", None)
        else:
            os.environ["AUDIT_RETENTION_DAYS"] = old_env
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
