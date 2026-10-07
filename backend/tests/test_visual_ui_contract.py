"""Visual QA backend checks: auth sessions, role permissions, and harmless write denial."""

import json
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")
TEST_USERS_PATH = Path("/app/.data/design-reference/test-users.json")


def _load_users():
    if not TEST_USERS_PATH.exists():
        pytest.skip("test-users.json missing for visual/auth QA run")
    return json.loads(TEST_USERS_PATH.read_text(encoding="utf-8"))


def _login(email: str, password: str):
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    return session, response


def _csrf_headers(session: requests.Session):
    token = session.cookies.get("houston_csrf")
    return {"X-CSRF-Token": token} if token else {}


def test_health_endpoint_operational():
    response = requests.get(f"{BASE_URL}/api/health", timeout=20)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert data["database"] == "postgresql"


def test_member_login_and_profile_fetch():
    users = _load_users()
    session, login = _login(users["member"]["email"], users["member"]["password"])
    assert login.status_code == 200
    assert session.cookies.get("houston_session")
    me = session.get(f"{BASE_URL}/api/auth/me", timeout=20)
    assert me.status_code == 200
    profile = me.json()
    assert profile["id"] == users["member"]["id"]
    assert profile["role"] == "MEMBER"


def test_viewer_login_and_profile_fetch():
    users = _load_users()
    session, login = _login(users["viewer"]["email"], users["viewer"]["password"])
    assert login.status_code == 200
    assert session.cookies.get("houston_session")
    me = session.get(f"{BASE_URL}/api/auth/me", timeout=20)
    assert me.status_code == 200
    profile = me.json()
    assert profile["id"] == users["viewer"]["id"]
    assert profile["role"] == "VIEWER"


def test_viewer_write_attempt_is_forbidden_no_mutation():
    users = _load_users()
    session, login = _login(users["viewer"]["email"], users["viewer"]["password"])
    assert login.status_code == 200

    before = session.get(f"{BASE_URL}/api/locations", timeout=20)
    assert before.status_code == 200
    before_data = before.json()
    before_count = len(before_data)

    attempt = session.post(
        f"{BASE_URL}/api/locations",
        json={"name": "TEST_VISUAL_FORBIDDEN_LOCATION", "type": "ROOM"},
        headers=_csrf_headers(session),
        timeout=20,
    )
    assert attempt.status_code == 403

    after = session.get(f"{BASE_URL}/api/locations", timeout=20)
    assert after.status_code == 200
    after_data = after.json()
    assert len(after_data) == before_count
    assert all(item.get("name") != "TEST_VISUAL_FORBIDDEN_LOCATION" for item in after_data)


def test_member_read_flow_locations_entities_overview():
    users = _load_users()
    session, login = _login(users["member"]["email"], users["member"]["password"])
    assert login.status_code == 200

    loc = session.get(f"{BASE_URL}/api/locations", timeout=20)
    entities = session.get(f"{BASE_URL}/api/entities", timeout=20)
    overview = session.get(f"{BASE_URL}/api/overview", timeout=20)

    assert loc.status_code == 200
    assert isinstance(loc.json(), list)
    assert entities.status_code == 200
    assert isinstance(entities.json(), list)
    assert overview.status_code == 200
    data = overview.json()
    assert "counts" in data
    assert "attention" in data
    assert isinstance(data["attention"], list)
