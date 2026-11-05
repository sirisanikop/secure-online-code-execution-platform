"""TC-SEC-*, TC-OPS-01: platform-level security requirements (CEP-SR-001..010, CEP-NF-007)."""
import os
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select

from app.models import AuditEvent, User
from app.services import audit
from tests.conftest import make_settings, register_login, run


def test_TC_SEC_01_user_code_runs_in_separate_process(client, auth):
    r = run(client, auth, "import os\nprint(os.getpid(), os.getppid())")
    child, parent = (int(x) for x in r["stdout"].split())
    assert child != os.getpid()                      # not inside the server process
    assert parent == os.getpid() or parent != 0      # started by the server


def test_TC_SEC_02_no_plaintext_password_anywhere(client):
    pw = "Sup3rSecretPw"
    r = client.post("/api/auth/register", json={"username": "zed", "password": pw})
    assert pw not in r.text
    r = client.post("/api/auth/login", json={"username": "zed", "password": pw})
    assert pw not in r.text
    with client.app.state.session_factory() as db:
        assert pw not in db.scalar(select(User.password_hash).where(User.username == "zed"))
        assert all(pw not in (e.detail or "") for e in db.scalars(select(AuditEvent)).all())


def test_TC_SEC_03_token_forgery_rejected(client, auth):
    secret = "test-secret-test-secret-test-secret-0123456789"
    uid = jwt.decode(auth["Authorization"].split()[1], secret, algorithms=["HS256"])["sub"]
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    forged = {
        "wrong secret": jwt.encode({"sub": uid, "exp": exp}, "x" * 40, "HS256"),
        "alg none": jwt.encode({"sub": uid, "exp": exp}, None, algorithm="none"),
        "no exp": jwt.encode({"sub": uid}, secret, "HS256"),
        "unknown user": jwt.encode({"sub": "99999", "exp": exp}, secret, "HS256"),
        "non numeric sub": jwt.encode({"sub": "abc", "exp": exp}, secret, "HS256"),
    }
    for name, tok in forged.items():
        r = client.get("/api/auth/me", headers={"Authorization": "Bearer " + tok})
        assert r.status_code == 401, name
    # the admin claim inside a token is not trusted: admin rights come from the database
    fake_admin = jwt.encode({"sub": uid, "adm": True, "exp": exp}, secret, "HS256")
    assert client.get("/api/admin/stats", headers={"Authorization": "Bearer " + fake_admin}).status_code == 403


def test_TC_SEC_04_object_level_authorisation(client, auth):
    rid = run(client, auth, "print('mine')")["id"]
    mallory = register_login(client, "mallory", "Passw0rd1")
    assert client.get(f"/api/executions/{rid}", headers=mallory).status_code == 404
    assert client.delete(f"/api/executions/{rid}", headers=mallory).status_code == 404


def test_TC_SEC_05_input_validation_and_sql_injection(client, auth):
    evil = "x'; DROP TABLE users; --"
    assert client.post("/api/auth/login", json={"username": evil, "password": evil}).status_code == 401
    assert client.post("/api/auth/register", json={"username": evil, "password": "Passw0rd1"}).status_code == 422
    r = run(client, auth, "print(\"'; DROP TABLE executions; --\")", evil)   # stored inertly
    assert client.get(f"/api/executions/{r['id']}", headers=auth).json()["stdin"] == evil
    assert client.get("/api/executions?limit=1%20OR%201=1", headers=auth).status_code == 422
    assert client.post("/api/executions", data="not json", headers={**auth, "Content-Type": "application/json"}).status_code == 422
    assert client.post("/api/executions", json={"code": 123}, headers=auth).status_code == 422
    assert client.post("/api/executions", content=b"x" * 1_500_000, headers={**auth, "Content-Type": "application/json"}).status_code == 413
    assert client.get("/api/auth/me", headers=auth).status_code == 200  # tables still exist


def test_TC_SEC_06_child_environment_has_no_server_secrets(make_client):
    os.environ["JWT_SECRET"] = "env-secret-must-not-leak"
    try:
        c = make_client(admin_password="AdminPass1")
        h = register_login(c)
        r = run(c, h, "import os\nfor k, v in os.environ.items(): print(k, '=', v)")
    finally:
        del os.environ["JWT_SECRET"]
    out = r["stdout"]
    assert "env-secret-must-not-leak" not in out and "JWT_SECRET" not in out and "AdminPass1" not in out
    assert "codebox.db" not in out and "DATABASE_URL" not in out
    names = {ln.split(" = ")[0].upper() for ln in out.splitlines()}
    assert names <= {"SYSTEMROOT", "TEMP", "TMP", "PYTHONDONTWRITEBYTECODE", "PYTHONIOENCODING", "PYTHONUTF8"}


def test_TC_SEC_07_sandbox_policy_end_to_end_via_api(client, auth):
    """Representative denials through the public API (full matrix is TC-SBX-06)."""
    attacks = {
        "write": "import os\nos.mkdir('d')",
        "net": "import socket",
        "proc": "import os\nos.system('echo hacked')",
        "read": "import os\nos.listdir('C:\\\\')",
    }
    for name, code in attacks.items():
        r = run(client, auth, code)
        assert r["status"] in ("BLOCKED", "RUNTIME_ERROR"), (name, r)
        assert "hacked" not in r["stdout"]
        assert r["status"] == "BLOCKED" or "Sandbox policy" in r["stderr"], (name, r)


def test_TC_SEC_08_cors_and_security_headers(client):
    ok = client.options("/api/auth/login", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/api/auth/login", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert r.headers["cache-control"] == "no-store"


def test_TC_SEC_09_security_events_audited_without_secrets(client, auth, admin_auth):
    client.post("/api/auth/login", json={"username": "alice", "password": "BadPassw0rd"})
    run(client, auth, "import subprocess")
    run(client, auth, "x = [0] * 10**9")
    client.get("/api/admin/audit-events", headers=admin_auth)  # first admin access is itself audited
    events = client.get("/api/admin/audit-events?limit=200", headers=admin_auth).json()["items"]
    types = {e["event_type"] for e in events}
    assert {"LOGIN_FAILED", "BLOCKED_CODE", "MEMORY_LIMIT", "ADMIN_ACCESS"} <= types
    blob = " ".join(e["detail"] for e in events)
    assert "BadPassw0rd" not in blob and "Passw0rd1" not in blob and "eyJ" not in blob


def test_TC_SEC_10_rate_limiting_login_and_execution(make_client):
    c = make_client(rate_limit_runs_per_min=2, login_max_failures=3)
    h = register_login(c)
    codes = [c.post("/api/executions", json={"code": "print(1)"}, headers=h).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    seen = [c.post("/api/auth/login", json={"username": "alice", "password": "WrongPass1"}).status_code for _ in range(5)]
    assert seen == [401, 401, 401, 429, 429]


def test_TC_OPS_01_audit_retention_and_query(tmpdir_path):
    from app.main import create_app
    st = make_settings(tmpdir_path, database_url=f"sqlite:///{tmpdir_path}/ops.db", audit_retention_days=90)
    app = create_app(st)
    with app.state.session_factory() as db:
        old = AuditEvent(event_type="LOGIN_FAILED", detail="old", created_at=datetime.now(timezone.utc) - timedelta(days=100))
        db.add(old)
        db.commit()
        audit.log(db, audit.BLOCKED_CODE, None, "fresh", "127.0.0.1")
        assert db.scalar(select(AuditEvent).where(AuditEvent.detail == "old")) is not None
    app2 = create_app(st)  # start-up purges events older than the retention window
    with app2.state.session_factory() as db:
        details = {e.detail for e in db.scalars(select(AuditEvent)).all()}
        assert "old" not in details and "fresh" in details
