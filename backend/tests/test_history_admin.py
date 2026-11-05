"""TC-HIS-* and TC-ADM-*: history, ownership, administration (CEP-F-030..033, CEP-F-050..052)."""
from sqlalchemy import select

from app.models import Execution
from tests.conftest import register_login, run


def test_TC_HIS_01_run_is_persisted_with_owner(client, auth):
    r = run(client, auth, "print('saved')", "in")
    d = client.get(f"/api/executions/{r['id']}", headers=auth).json()
    assert d["code"] == "print('saved')" and d["stdin"] == "in" and d["stdout"] == "saved\n" and d["status"] == "COMPLETED"
    with client.app.state.session_factory() as db:
        row = db.scalar(select(Execution).where(Execution.id == r["id"]))
        assert row.user.username == "alice"


def test_TC_HIS_02_list_newest_first_with_pagination(client, auth):
    ids = [run(client, auth, f"print({i})")["id"] for i in range(7)]
    page1 = client.get("/api/executions?limit=3&offset=0", headers=auth).json()
    page2 = client.get("/api/executions?limit=3&offset=3", headers=auth).json()
    page3 = client.get("/api/executions?limit=3&offset=6", headers=auth).json()
    assert page1["total"] == 7
    got = [i["id"] for i in page1["items"] + page2["items"] + page3["items"]]
    assert got == list(reversed(ids))
    assert page1["items"][0]["code_preview"] == "print(6)"
    assert client.get("/api/executions?limit=0", headers=auth).status_code == 422


def test_TC_HIS_03_other_users_get_404(client, auth):
    rid = run(client, auth, "print('secret')")["id"]
    bob = register_login(client, "bob", "Passw0rd1")
    assert client.get(f"/api/executions/{rid}", headers=bob).status_code == 404
    assert client.delete(f"/api/executions/{rid}", headers=bob).status_code == 404
    assert client.get("/api/executions", headers=bob).json() == {"items": [], "total": 0}
    assert client.get(f"/api/executions/{rid}", headers=auth).status_code == 200  # untouched
    assert client.get("/api/executions/99999", headers=auth).status_code == 404


def test_TC_HIS_04_delete_own_run(client, auth):
    rid = run(client, auth, "print(1)")["id"]
    assert client.delete(f"/api/executions/{rid}", headers=auth).status_code == 204
    assert client.get(f"/api/executions/{rid}", headers=auth).status_code == 404


def test_TC_ADM_01_audit_events_filter(client, auth, admin_auth):
    run(client, auth, "import socket")             # BLOCKED_CODE
    run(client, auth, "while True: pass")          # TIMEOUT
    r = client.get("/api/admin/audit-events?type=BLOCKED_CODE", headers=admin_auth).json()
    assert r["total"] == 1 and all(e["event_type"] == "BLOCKED_CODE" for e in r["items"])
    assert "socket" in r["items"][0]["detail"]
    r = client.get("/api/admin/audit-events?type=TIMEOUT", headers=admin_auth).json()
    assert r["total"] == 1
    everything = client.get("/api/admin/audit-events?limit=200", headers=admin_auth).json()
    assert {"BLOCKED_CODE", "TIMEOUT", "ADMIN_ACCESS"} <= {e["event_type"] for e in everything["items"]}
    future = client.get("/api/admin/audit-events?from=2999-01-01T00:00:00", headers=admin_auth).json()
    assert future["total"] == 0


def test_TC_ADM_02_statistics(client, auth, admin_auth):
    run(client, auth, "print(1)")
    run(client, auth, "print(2)")
    run(client, auth, "1/0")
    s = client.get("/api/admin/stats", headers=admin_auth).json()
    assert s["total_runs"] == 3 and s["runs_by_status"] == {"COMPLETED": 2, "RUNTIME_ERROR": 1}
    assert s["total_users"] == 2 and s["active_users_24h"] == 1 and s["avg_runtime_ms"] > 0


def test_TC_ADM_03_non_admin_gets_403(client, auth):
    for path in ("/api/admin/stats", "/api/admin/audit-events"):
        r = client.get(path, headers=auth)
        assert r.status_code == 403 and r.json()["error"]["code"] == "FORBIDDEN"
