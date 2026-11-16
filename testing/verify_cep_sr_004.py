"""Verification script and test suite for CEP-SR-004: Object-level auth.

Requirement: CEP-SR-004
Access to executions shall be restricted to the owning user (object-level authorisation).
Acceptance Criteria (AC-SR-004):
Cross-user access returns 404.

Test Cases: TC-SEC-04, TC-HIS-03
Related Requirements: CEP-F-032 (Owner-only detail), CEP-F-033 (Delete run)
Design Specification: DS-HIS-01 (SRS 5.1.2, SAD 3.9, 4.1, 4.3)
"""
import os
import sys
import tempfile
import shutil
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
    print("VERIFICATION SUITE: CEP-SR-004 (Object-Level Authorization)")
    print("=" * 70)

    tmp = tempfile.mkdtemp(prefix="cb_sec_verify_")
    try:
        st = Settings()
        st.database_url = "sqlite:///:memory:"
        st.sandbox_root = os.path.join(tmp, "sbx")
        st.jwt_secret = "verify-secret-cep-sr-004-super-secret-token-key-32chars"
        st.bcrypt_rounds = 4
        st.rate_limit_runs_per_min = 1000

        app = create_app(st)
        client = TestClient(app)

        # 1. Setup Alice (owner), Bob (unauthorized peer), and Mallory (adversary)
        print("[1/7] Registering and authenticating test accounts (Alice, Bob, Mallory)...")
        for username in ["alice", "bob", "mallory"]:
            r = client.post("/api/auth/register", json={"username": username, "password": "Passw0rd1"})
            assert r.status_code == 201, f"Register {username} failed: {r.text}"

        def get_auth(username):
            r = client.post("/api/auth/login", json={"username": username, "password": "Passw0rd1"})
            assert r.status_code == 200, f"Login {username} failed: {r.text}"
            return {"Authorization": "Bearer " + r.json()["access_token"]}

        alice_auth = get_auth("alice")
        bob_auth = get_auth("bob")
        mallory_auth = get_auth("mallory")
        print("      PASS: Alice, Bob, and Mallory registered and authenticated.")

        # 2. Alice executes code containing private logic
        print("[2/7] Alice submits private code executions...")
        r1 = client.post(
            "/api/executions",
            json={"code": "secret_data = 42\nprint('Alice confidential data')", "stdin": "confidential_in"},
            headers=alice_auth
        )
        assert r1.status_code == 200
        alice_exec_1 = r1.json()["id"]

        r2 = client.post(
            "/api/executions",
            json={"code": "raise ValueError('Alice internal bug')", "stdin": ""},
            headers=alice_auth
        )
        assert r2.status_code == 200
        alice_exec_2 = r2.json()["id"]

        print(f"      PASS: Alice created executions ID={alice_exec_1} and ID={alice_exec_2}.")

        # 3. Object-level auth on Read: Cross-user access returns 404 (AC-SR-004)
        print("[3/7] Bob and Mallory attempt to read Alice's execution detail (GET /api/executions/{id})...")
        for user_name, user_auth in [("Bob", bob_auth), ("Mallory", mallory_auth)]:
            r = client.get(f"/api/executions/{alice_exec_1}", headers=user_auth)
            assert r.status_code == 404, f"Expected 404 for {user_name}, got {r.status_code}"
            assert r.json()["error"]["code"] == "NOT_FOUND"
            assert "Execution not found" in r.json()["error"]["message"]

            r_bug = client.get(f"/api/executions/{alice_exec_2}", headers=user_auth)
            assert r_bug.status_code == 404, f"Expected 404 for {user_name}, got {r_bug.status_code}"

        print("      PASS: Cross-user read access strictly blocked with HTTP 404.")

        # 4. Object-level auth on Delete: Cross-user deletion returns 404
        print("[4/7] Bob attempts to delete Alice's execution (DELETE /api/executions/{id})...")
        del_r = client.delete(f"/api/executions/{alice_exec_1}", headers=bob_auth)
        assert del_r.status_code == 404, f"Expected 404 for unauthorized delete, got {del_r.status_code}"
        assert del_r.json()["error"]["code"] == "NOT_FOUND"
        print("      PASS: Cross-user deletion blocked with HTTP 404.")

        # 5. Alice's data integrity verified after unauthorized read/delete attempts
        print("[5/7] Verifying Alice's records remain untouched and intact...")
        alice_read = client.get(f"/api/executions/{alice_exec_1}", headers=alice_auth)
        assert alice_read.status_code == 200
        data = alice_read.json()
        assert data["id"] == alice_exec_1
        assert "Alice confidential data" in data["stdout"]
        assert data["stdin"] == "confidential_in"
        print("      PASS: Owner can read execution; data integrity verified intact.")

        # 6. Anti-enumeration security check (uniform 404 for non-existent vs forbidden)
        print("[6/7] Verifying anti-enumeration defense (uniform 404 behavior)...")
        # Querying non-existent ID by Alice
        non_existent_r = client.get("/api/executions/999999", headers=alice_auth)
        assert non_existent_r.status_code == 404
        # Querying Alice's existing ID by Bob
        forbidden_r = client.get(f"/api/executions/{alice_exec_1}", headers=bob_auth)
        assert forbidden_r.status_code == 404

        # Verify response structure and error message are identical to prevent ID enumeration
        assert non_existent_r.json() == forbidden_r.json() == {
            "error": {"code": "NOT_FOUND", "message": "Execution not found"}
        }
        print("      PASS: Responses are identical, preventing object enumeration and presence oracles.")

        # 7. Unauthenticated and Token security checks
        print("[7/7] Verifying unauthenticated / invalid token rejections (401)...")
        no_auth = client.get(f"/api/executions/{alice_exec_1}")
        assert no_auth.status_code == 401

        bad_auth = client.get(f"/api/executions/{alice_exec_1}", headers={"Authorization": "Bearer bad.token.here"})
        assert bad_auth.status_code == 401

        # Delete own run by Alice succeeds
        del_ok = client.delete(f"/api/executions/{alice_exec_2}", headers=alice_auth)
        assert del_ok.status_code == 204
        assert client.get(f"/api/executions/{alice_exec_2}", headers=alice_auth).status_code == 404
        print("      PASS: Unauthenticated requests rejected (401) and owner self-delete succeeds (204).")

        print("=" * 70)
        print("ALL VERIFICATIONS PASSED FOR CEP-SR-004 (TC-SEC-04 & TC-HIS-03)")
        print("=" * 70)
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
