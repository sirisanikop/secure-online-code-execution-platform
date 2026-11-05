import os
import shutil
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402


def make_settings(tmp: str, **over) -> Settings:
    base = dict(database_url="sqlite:///:memory:", sandbox_root=os.path.join(tmp, "sbx"), jwt_secret="test-secret-test-secret-test-secret-0123456789",
                bcrypt_rounds=4, admin_username="admin", admin_password="AdminPass1", rate_limit_runs_per_min=1000,
                frontend_origin="http://localhost:5173")
    base.update(over)
    st = Settings()
    for k, v in base.items():
        setattr(st, k, v)
    return st


@pytest.fixture()
def tmpdir_path():
    d = tempfile.mkdtemp(prefix="cbtest_")
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture()
def make_client(tmpdir_path):
    clients = []

    def _make(**over):
        app = create_app(make_settings(tmpdir_path, **over))
        c = TestClient(app)
        clients.append(c)
        return c
    yield _make


@pytest.fixture()
def client(make_client):
    return make_client()


def register_login(client, username="alice", password="Passw0rd1"):
    r = client.post("/api/auth/register", json={"username": username, "password": password})
    assert r.status_code in (201, 409), r.text
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}


@pytest.fixture()
def auth(client):
    return register_login(client)


@pytest.fixture()
def admin_auth(client):
    return register_login(client, "admin", "AdminPass1")


def run(client, auth, code, stdin=""):
    r = client.post("/api/executions", json={"code": code, "stdin": stdin}, headers=auth)
    assert r.status_code == 200, r.text
    return r.json()
