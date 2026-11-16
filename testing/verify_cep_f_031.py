"""Verification script and test suite for CEP-F-031: List history.

Requirement: CEP-F-031
The system shall list a user's own executions newest first with pagination.
Acceptance Criteria (AC-F-031):
GET /api/executions?limit=5&offset=5 returns the second page in descending time order.

Test Case: TC-HIS-02
Design Specification: DS-HIS-01 (SRS 4.4, SAD 4.1, 4.3)
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
    print("VERIFICATION SUITE: CEP-F-031 (List History with Pagination)")
    print("=" * 70)

    tmp = tempfile.mkdtemp(prefix="cb_hist_verify_")
    try:
        st = Settings()
        st.database_url = "sqlite:///:memory:"
        st.sandbox_root = os.path.join(tmp, "sbx")
        st.jwt_secret = "verify-secret-cep-f-031-super-secret-token-key-32chars"
        st.bcrypt_rounds = 4
        st.rate_limit_runs_per_min = 1000

        app = create_app(st)
        client = TestClient(app)

        # 1. Setup User Alice
        print("[1/6] Registering and authenticating test user (Alice)...")
        r = client.post("/api/auth/register", json={"username": "alice", "password": "Passw0rd1"})
        assert r.status_code == 201, f"Registration failed: {r.text}"
        r = client.post("/api/auth/login", json={"username": "alice", "password": "Passw0rd1"})
        assert r.status_code == 200, f"Login failed: {r.text}"
        alice_auth = {"Authorization": "Bearer " + r.json()["access_token"]}
        print("      PASS: Alice registered and logged in.")

        # 2. Populate 10 Executions
        print("[2/6] Submitting 10 test code executions for Alice...")
        created_ids = []
        for i in range(10):
            # Include long code to test preview truncation (80 chars max)
            code = f"# Execution index {i}\nprint('Hello from run {i}')\n" + ("# padding comment\n" * 5)
            r = client.post("/api/executions", json={"code": code, "stdin": ""}, headers=alice_auth)
            assert r.status_code == 200, f"Run {i} failed: {r.text}"
            res = r.json()
            created_ids.append(res["id"])
            print(f"      Run {i} created with ID={res['id']}, status={res['status']}")

        print(f"      PASS: 10 executions created successfully: {created_ids}")

        # 3. Test Pagination Pages
        print("[3/6] Testing pagination (limit=3)...")
        page1 = client.get("/api/executions?limit=3&offset=0", headers=alice_auth).json()
        page2 = client.get("/api/executions?limit=3&offset=3", headers=alice_auth).json()
        page3 = client.get("/api/executions?limit=3&offset=6", headers=alice_auth).json()
        page4 = client.get("/api/executions?limit=3&offset=9", headers=alice_auth).json()
        page5 = client.get("/api/executions?limit=3&offset=12", headers=alice_auth).json()

        assert page1["total"] == 10, f"Expected total=10, got {page1['total']}"
        assert len(page1["items"]) == 3, f"Expected 3 items on page 1, got {len(page1['items'])}"
        assert len(page2["items"]) == 3, f"Expected 3 items on page 2, got {len(page2['items'])}"
        assert len(page3["items"]) == 3, f"Expected 3 items on page 3, got {len(page3['items'])}"
        assert len(page4["items"]) == 1, f"Expected 1 item on page 4, got {len(page4['items'])}"
        assert len(page5["items"]) == 0, f"Expected 0 items on page 5 (past end), got {len(page5['items'])}"
        print("      PASS: Page counts and boundaries match expected limits and offsets.")

        # 4. Test Newest-First Ordering
        print("[4/6] Verifying newest-first descending chronological order...")
        all_paginated_ids = [
            item["id"] for item in (page1["items"] + page2["items"] + page3["items"] + page4["items"])
        ]
        expected_order = list(reversed(created_ids))
        assert all_paginated_ids == expected_order, (
            f"Ordering mismatch!\nGot:      {all_paginated_ids}\nExpected: {expected_order}"
        )
        print(f"      PASS: Executions returned newest-first: {all_paginated_ids}")

        # 5. Verify Code Preview & Metadata
        print("[5/6] Verifying code_preview truncation and summary fields...")
        first_item = page1["items"][0]
        assert len(first_item["code_preview"]) <= 80, (
            f"Code preview exceeds 80 characters: {len(first_item['code_preview'])}"
        )
        assert first_item["code_preview"].startswith("# Execution index 9")
        assert "status" in first_item
        assert "runtime_ms" in first_item
        assert "created_at" in first_item
        print(f"      PASS: Summary fields present and code_preview correctly capped at <= 80 chars.")

        # 6. Verify Parameter Validation & Isolation
        print("[6/6] Verifying query parameter validation and user isolation...")
        # Boundary tests on query parameters
        assert client.get("/api/executions?limit=0", headers=alice_auth).status_code == 422
        assert client.get("/api/executions?limit=101", headers=alice_auth).status_code == 422
        assert client.get("/api/executions?offset=-1", headers=alice_auth).status_code == 422

        # Register User Bob and ensure Bob has an empty history
        client.post("/api/auth/register", json={"username": "bob", "password": "Passw0rd1"})
        r_bob = client.post("/api/auth/login", json={"username": "bob", "password": "Passw0rd1"})
        bob_auth = {"Authorization": "Bearer " + r_bob.json()["access_token"]}
        bob_history = client.get("/api/executions", headers=bob_auth).json()
        assert bob_history["total"] == 0
        assert bob_history["items"] == []
        print("      PASS: Parameter limits enforced (422) and user history strictly isolated.")

        print("=" * 70)
        print("ALL VERIFICATIONS PASSED FOR CEP-F-031 (TC-HIS-02)")
        print("=" * 70)
        return True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
