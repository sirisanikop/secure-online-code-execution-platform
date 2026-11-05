"""TC-AUTH-*: registration, login, tokens, throttling (CEP-F-001..005, CEP-SR-002/003)."""
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select

from app.models import AuditEvent, User
from tests.conftest import register_login

SECRET = "test-secret-test-secret-test-secret-0123456789"


def test_TC_AUTH_01_register_valid(client):
    r = client.post("/api/auth/register", json={"username": "Alice_1", "password": "Passw0rd1"})
    assert r.status_code == 201
    body = r.json()
    assert body["username"] == "alice_1" and "id" in body
    assert "password" not in body and "password_hash" not in body


def test_TC_AUTH_02_password_stored_as_bcrypt_hash(client):
    client.post("/api/auth/register", json={"username": "bob", "password": "Passw0rd1"})
    with client.app.state.session_factory() as db:
        u = db.scalar(select(User).where(User.username == "bob"))
        assert u.password_hash.startswith("$2") and "Passw0rd1" not in u.password_hash
    r = client.post("/api/auth/login", json={"username": "bob", "password": "Passw0rd1"})
    assert "Passw0rd1" not in r.text


def test_TC_AUTH_03_login_issues_signed_expiring_token(client):
    client.post("/api/auth/register", json={"username": "carol", "password": "Passw0rd1"})
    r = client.post("/api/auth/login", json={"username": "carol", "password": "Passw0rd1"})
    assert r.status_code == 200
    data = r.json()
    assert data["token_type"] == "bearer" and data["expires_in"] == 3600
    claims = jwt.decode(data["access_token"], SECRET, algorithms=["HS256"])
    assert 3500 < claims["exp"] - claims["iat"] <= 3600
    expired = jwt.encode({"sub": claims["sub"], "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, SECRET, "HS256")
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer " + expired}).status_code == 401


def test_TC_AUTH_04_throttle_after_five_failures(client):
    client.post("/api/auth/register", json={"username": "dave", "password": "Passw0rd1"})
    for _ in range(5):
        r = client.post("/api/auth/login", json={"username": "dave", "password": "wrong-pass1"})
        assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_CREDENTIALS"
    r = client.post("/api/auth/login", json={"username": "dave", "password": "Passw0rd1"})  # correct, but locked
    assert r.status_code == 429 and "Retry-After" in r.headers
    with client.app.state.session_factory() as db:
        types = [e.event_type for e in db.scalars(select(AuditEvent)).all()]
    assert types.count("LOGIN_FAILED") == 5 and "LOGIN_THROTTLED" in types


def test_TC_AUTH_05_token_required_on_protected_endpoints(client, auth):
    for method, path in (("get", "/api/executions"), ("post", "/api/executions"), ("get", "/api/auth/me"),
                         ("get", "/api/admin/stats"), ("delete", "/api/executions/1")):
        kw = {"json": {"code": "print(1)"}} if method == "post" else {}
        assert getattr(client, method)(path, **kw).status_code == 401, path
    assert client.get("/api/executions", headers={"Authorization": "Bearer garbage"}).status_code == 401
    token = auth["Authorization"].split()[1]
    tampered = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
    assert client.get("/api/executions", headers={"Authorization": "Bearer " + tampered}).status_code == 401
    assert client.get("/api/executions", headers=auth).status_code == 200


def test_TC_AUTH_06_duplicate_and_invalid_registration(client):
    ok = {"username": "erin", "password": "Passw0rd1"}
    assert client.post("/api/auth/register", json=ok).status_code == 201
    assert client.post("/api/auth/register", json={"username": "ERIN", "password": "Passw0rd1"}).status_code == 409
    for bad in ({"username": "ab", "password": "Passw0rd1"}, {"username": "has space", "password": "Passw0rd1"},
                {"username": "frank", "password": "short1"}, {"username": "frank", "password": "onlyletters"},
                {"username": "frank", "password": "12345678"}, {"username": "frank", "password": "a1" * 40}):
        r = client.post("/api/auth/register", json=bad)
        assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR", bad


def test_login_wrong_user_same_message_as_wrong_password(client):
    client.post("/api/auth/register", json={"username": "gina", "password": "Passw0rd1"})
    a = client.post("/api/auth/login", json={"username": "gina", "password": "nope-nope1"})
    b = client.post("/api/auth/login", json={"username": "nobody", "password": "nope-nope1"})
    assert a.status_code == b.status_code == 401 and a.json() == b.json()
