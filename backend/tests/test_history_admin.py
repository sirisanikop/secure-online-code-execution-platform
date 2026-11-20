"""TC-HIS-* and TC-ADM-*: history, ownership, administration (CEP-F-030..033, CEP-F-050..052)."""
from datetime import datetime, timedelta, timezone

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


def test_TC_ADM_01_audit_events_date_range_and_timezone(client, auth, admin_auth):
    run(client, auth, "import socket")
    now_utc = datetime.now(timezone.utc)
    ist = timezone(timedelta(hours=5, minutes=30))
    window_start = (now_utc - timedelta(minutes=5)).astimezone(ist).isoformat()
    window_end = (now_utc + timedelta(minutes=5)).astimezone(ist).isoformat()
    past_end = (now_utc - timedelta(minutes=10)).astimezone(ist).isoformat()

    inside = client.get(
        "/api/admin/audit-events",
        params={"type": "BLOCKED_CODE", "from": window_start, "to": window_end},
        headers=admin_auth,
    ).json()
    assert inside["total"] == 1
    assert inside["items"][0]["event_type"] == "BLOCKED_CODE"

    before = client.get(
        "/api/admin/audit-events",
        params={"type": "BLOCKED_CODE", "to": past_end},
        headers=admin_auth,
    ).json()
    assert before["total"] == 0


def test_TC_ADM_01_every_run_is_audited_under_its_user(make_client):
    """Successful runs must be visible to the admin under the user who ran them, and never as ADMIN_ACCESS."""
    c = make_client(rate_limit_runs_per_min=3)
    user = register_login(c, "alice", "Passw0rd1")
    admin = register_login(c, "admin", "AdminPass1")
    ids = [run(c, user, code)["id"] for code in ("print(1)", "1/0", "import socket")]  # completed, error, blocked
    refused = c.post("/api/executions", json={"code": "print(2)"}, headers=user)  # the 4th run in a minute
    assert refused.status_code == 429
    uid = c.get("/api/auth/me", headers=user).json()["id"]
    aid = c.get("/api/auth/me", headers=admin).json()["id"]

    runs = c.get("/api/admin/audit-events?type=EXECUTION&limit=50", headers=admin).json()
    assert runs["total"] == 3 and all(e["user_id"] == uid for e in runs["items"])
    assert {e["detail"].split()[2] for e in runs["items"]} == {"COMPLETED", "RUNTIME_ERROR", "BLOCKED"}
    assert {int(e["detail"].split()[1].lstrip("#")) for e in runs["items"]} == set(ids)
    blob = " ".join(e["detail"] for e in runs["items"])
    assert "print(1)" not in blob and "socket" not in blob  # no source code in the audit trail

    rate = c.get("/api/admin/audit-events?type=RATE_LIMITED", headers=admin).json()  # the refused run is not an EXECUTION
    assert rate["total"] == 1 and rate["items"][0]["user_id"] == uid

    c.get("/api/admin/stats", headers=admin)
    views = c.get("/api/admin/audit-events?type=ADMIN_ACCESS&limit=50", headers=admin).json()["items"]
    assert views and all(e["user_id"] == aid for e in views)  # admin page views belong to the admin only


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
