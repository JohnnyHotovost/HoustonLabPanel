"""Foundation slice regression tests: auth/RBAC + core household flows."""
import hashlib
import io
import json
import os
import secrets
import time
from datetime import date, timedelta

import pytest
import requests
from dotenv import dotenv_values
from pypdf import PdfWriter
from sqlalchemy import create_engine, text


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")


def _auth_headers(session: requests.Session):
    token = session.cookies.get("houston_csrf")
    return {"X-CSRF-Token": token} if token else {}


def _json(session: requests.Session, method: str, path: str, *, payload=None, headers=None):
    hdrs = {}
    hdrs.update(_auth_headers(session))
    if headers:
        hdrs.update(headers)
    return session.request(method, f"{BASE_URL}/api{path}", json=payload, headers=hdrs)


def _strong_temp_password() -> str:
    return f"Tmp!{secrets.token_urlsafe(12)}A9"


def _two_page_pdf_bytes() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    writer.add_blank_page(width=595, height=842)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.fixture(scope="session")
def owner_creds():
    creds_path = "/app/.data/qa-credentials.json"
    if not os.path.exists(creds_path):
        pytest.skip("QA credentials file missing: /app/.data/qa-credentials.json")
    with open(creds_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["owner"]


@pytest.fixture(scope="session")
def owner_session(owner_creds):
    s = requests.Session()
    resp = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": owner_creds["email"], "password": owner_creds["password"]},
    )
    assert resp.status_code == 200
    assert s.cookies.get("houston_session")
    assert s.cookies.get("houston_csrf")
    return s


@pytest.fixture(scope="session")
def qa_state(owner_session):
    """Create and keep QA fixtures for regression and manual verification."""
    state = {}

    admin_email = "test_qa_admin_20261007@example.com"
    member_email = "test_qa_member_20261007@example.com"
    viewer_email = "test_qa_viewer_20261007@example.com"
    password = _strong_temp_password()

    users = _json(owner_session, "GET", "/users").json()
    by_email = {u.get("email"): u for u in users if u.get("email")}
    for email, role, name in [
        (admin_email, "ADMIN", "TEST_QA_Admin 2026-10-07"),
        (member_email, "MEMBER", "TEST_QA_Member 2026-10-07"),
        (viewer_email, "VIEWER", "TEST_QA_Viewer 2026-10-07"),
    ]:
        if email in by_email:
            state[role.lower() + "_id"] = by_email[email]["id"]
            continue
        r = _json(
            owner_session,
            "POST",
            "/users",
            payload={"email": email, "name": name, "password": password, "role": role},
        )
        assert r.status_code == 201
        created = r.json()
        state[role.lower() + "_id"] = created["id"]

    state["admin_email"] = admin_email
    state["member_email"] = member_email
    state["viewer_email"] = viewer_email
    state["user_password"] = password

    # Create recursive locations only once.
    locs = _json(owner_session, "GET", "/locations").json()
    path_map = {l["path"]: l for l in locs}

    def ensure_location(name, typ, parent_id=None):
        target_path = name if not parent_id else None
        if parent_id:
            parent = next((v for v in locs if v["id"] == parent_id), None)
            if parent:
                target_path = f"{parent['path']} / {name}"
        if target_path and target_path in path_map:
            return path_map[target_path]["id"]
        resp = _json(owner_session, "POST", "/locations", payload={"name": name, "type": typ, "parent_id": parent_id})
        assert resp.status_code == 201
        loc = resp.json()
        locs.append({**loc, "path": target_path or name})
        return loc["id"]

    house_id = ensure_location("TEST_QA_House", "ROOM")
    garage_id = ensure_location("TEST_QA_Garage", "AREA", house_id)
    cabinet_id = ensure_location("TEST_QA_Cabinet", "CABINET", garage_id)
    box_id = ensure_location("TEST_QA_Box", "BOX", cabinet_id)
    state.update({"house_id": house_id, "garage_id": garage_id, "cabinet_id": cabinet_id, "box_id": box_id})

    return state


def _login(email: str, password: str):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    return s, r


# auth/security module
def test_health_and_setup_status():
    health = requests.get(f"{BASE_URL}/api/health")
    assert health.status_code == 200
    h = health.json()
    assert h["database"] == "postgresql"

    status = requests.get(f"{BASE_URL}/api/auth/status")
    assert status.status_code == 200
    assert status.json()["setup_required"] is False


def test_owner_setup_is_singleton():
    s = requests.Session()
    setup_password = _strong_temp_password()
    r = s.post(
        f"{BASE_URL}/api/auth/setup",
        json={
            "name": "SHOULD_FAIL",
            "household_name": "SHOULD_FAIL",
            "email": "test_qa_dupe_owner@example.com",
            "password": setup_password,
            "language": "en",
        },
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "setup_complete"


def test_password_hash_is_argon2id(owner_creds):
    env = dotenv_values("/app/backend/.env")
    engine = create_engine(env["DATABASE_URL"])
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT password_hash FROM users WHERE email=:email"),
            {"email": owner_creds["email"].lower()},
        ).first()
    assert row is not None
    assert row[0].startswith("$argon2id$")


def test_unauthenticated_denied_for_read_and_write():
    r_read = requests.get(f"{BASE_URL}/api/entities")
    r_write = requests.post(f"{BASE_URL}/api/locations", json={"name": "x", "type": "ROOM"})
    assert r_read.status_code == 401
    assert r_write.status_code == 401


def test_csrf_and_hostile_origin_enforced(owner_session):
    no_csrf = owner_session.post(f"{BASE_URL}/api/locations", json={"name": "NO_CSRF", "type": "ROOM"})
    assert no_csrf.status_code == 403
    assert no_csrf.json()["detail"] == "csrf"

    hostile = owner_session.post(
        f"{BASE_URL}/api/locations",
        json={"name": "EVIL", "type": "ROOM"},
        headers={"Origin": "https://evil.example", **_auth_headers(owner_session)},
    )
    assert hostile.status_code == 403
    assert hostile.json()["detail"] == "csrf"


def test_logout_revokes_session(owner_creds):
    s, login = _login(owner_creds["email"], owner_creds["password"])
    assert login.status_code == 200
    out = _json(s, "POST", "/auth/logout")
    assert out.status_code == 200
    me = s.get(f"{BASE_URL}/api/auth/me")
    assert me.status_code == 401


def test_login_rate_limit_on_repeated_failures():
    email = f"test_qa_ratelimit_{time.time_ns()}@example.com"
    seen_429 = False
    for _ in range(20):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "bad-password"})
        if r.status_code == 429:
            seen_429 = True
            break
        assert r.status_code == 401
    assert seen_429, "Expected auth rate limiting (429) after repeated failed logins"


# users/rbac module
def test_viewer_is_read_only(qa_state):
    s, login = _login(qa_state["viewer_email"], qa_state["user_password"])
    assert login.status_code == 200
    resp = _json(s, "POST", "/locations", payload={"name": "VIEWER_TRY", "type": "ROOM"})
    assert resp.status_code == 403


def test_member_cannot_manage_users_or_archive(qa_state):
    s, login = _login(qa_state["member_email"], qa_state["user_password"])
    assert login.status_code == 200
    add_user = _json(
        s,
        "POST",
        "/users",
        payload={"email": "member_should_fail@example.com", "name": "Nope", "password": qa_state["user_password"], "role": "VIEWER"},
    )
    assert add_user.status_code == 403

    # Member cannot archive records.
    archive = _json(s, "POST", f"/entities/{'00000000-0000-0000-0000-000000000000'}/archive")
    assert archive.status_code == 403


def test_admin_cannot_promote_to_admin_or_alter_owner(owner_session, qa_state, owner_creds):
    s, login = _login(qa_state["admin_email"], qa_state["user_password"])
    assert login.status_code == 200

    promote = _json(s, "PATCH", f"/users/{qa_state['member_id']}", payload={"role": "ADMIN"})
    assert promote.status_code == 403

    users = _json(owner_session, "GET", "/users").json()
    owner_id = next(u["id"] for u in users if u["email"] == owner_creds["email"].lower())
    alter_owner = _json(s, "PATCH", f"/users/{owner_id}", payload={"active": False})
    assert alter_owner.status_code == 403


def test_role_change_immediate_for_existing_session(owner_session, qa_state):
    s, login = _login(qa_state["viewer_email"], qa_state["user_password"])
    assert login.status_code == 200
    blocked = _json(s, "POST", "/locations", payload={"name": "VIEWER_BEFORE", "type": "ROOM"})
    assert blocked.status_code == 403

    change = _json(owner_session, "PATCH", f"/users/{qa_state['viewer_id']}", payload={"role": "MEMBER"})
    assert change.status_code == 200
    assert change.json()["role"] == "MEMBER"

    allowed = _json(s, "POST", "/locations", payload={"name": "TEST_QA_RoleFlipRoom", "type": "ROOM"})
    assert allowed.status_code == 201

    revert = _json(owner_session, "PATCH", f"/users/{qa_state['viewer_id']}", payload={"role": "VIEWER"})
    assert revert.status_code == 200


def test_disabled_user_session_and_login_fail(owner_session, qa_state):
    s, login = _login(qa_state["member_email"], qa_state["user_password"])
    assert login.status_code == 200

    disable = _json(owner_session, "PATCH", f"/users/{qa_state['member_id']}", payload={"active": False})
    assert disable.status_code == 200

    me = s.get(f"{BASE_URL}/api/auth/me")
    assert me.status_code == 401

    s2, login2 = _login(qa_state["member_email"], qa_state["user_password"])
    assert login2.status_code == 401

    reenable = _json(owner_session, "PATCH", f"/users/{qa_state['member_id']}", payload={"active": True})
    assert reenable.status_code == 200


# locations/entities/service module
def test_location_cycle_rejected_and_descendant_entities_listed(owner_session, qa_state):
    cycle = _json(owner_session, "PATCH", f"/locations/{qa_state['house_id']}/move", payload={"parent_id": qa_state["box_id"]})
    assert cycle.status_code == 422
    assert cycle.json()["detail"] == "location_cycle"

    detail = _json(owner_session, "GET", f"/locations/{qa_state['house_id']}")
    assert detail.status_code == 200
    data = detail.json()
    assert data["id"] == qa_state["house_id"]
    assert isinstance(data["entities"], list)


def test_vehicle_components_and_mileage_constraints(owner_session, qa_state):
    payload = {
        "entity_type": "VEHICLE",
        "name": "TEST_QA_Vehicle_VAQ",
        "location_id": qa_state["garage_id"],
        "vehicle": {
            "manufacturer": "VW",
            "model": "Golf GTI",
            "plate": "TEST-QA-01",
            "vin": "QA123456789012345",
            "year": 2020,
            "mileage": 120000,
            "engine": "2.0 TSI",
            "transmission": "MANUAL",
            "drivetrain": "FWD",
            "differential": "VAQ",
        },
    }
    created = _json(owner_session, "POST", "/entities", payload=payload)
    assert created.status_code == 201
    vehicle = created.json()
    vehicle_id = vehicle["id"]

    detail = _json(owner_session, "GET", f"/entities/{vehicle_id}")
    assert detail.status_code == 200
    names = {c["name"] for c in detail.json()["components"]}
    assert "VAQ" in names
    assert "HALDEX" not in names
    assert "REAR_DIFFERENTIAL" not in names

    down = _json(owner_session, "POST", f"/entities/{vehicle_id}/mileage", payload={"mileage": 110000})
    assert down.status_code == 422
    assert down.json()["detail"] == "mileage_decrease"


def test_service_insufficient_stock_is_atomic_and_validation(owner_session, qa_state):
    inv_create = _json(
        owner_session,
        "POST",
        "/entities",
        payload={
            "entity_type": "INVENTORY",
            "name": "TEST_QA_Oil_5W30",
            "location_id": qa_state["cabinet_id"],
            "inventory": {"unit": "L", "consumable": True, "min_stock": 2, "initial_quantity": 3, "sku": "QA-OIL-5W30"},
        },
    )
    assert inv_create.status_code == 201
    inv = inv_create.json()

    vehicles = _json(owner_session, "GET", "/entities?entity_type=VEHICLE").json()
    vehicle = next(v for v in vehicles if v["name"] == "TEST_QA_Vehicle_VAQ")

    m1 = _json(
        owner_session,
        "POST",
        "/maintenance",
        payload={
            "entity_id": vehicle["id"],
            "title": "TEST_QA_Oil service",
            "strategy": "DISTANCE",
            "interval_km": 15000,
            "baseline_date": str(date.today() - timedelta(days=60)),
            "baseline_mileage": 120000,
            "source": "OWNER_DEFINED",
        },
    )
    assert m1.status_code == 201
    mid = m1.json()["id"]

    dup = _json(
        owner_session,
        "POST",
        "/service",
        payload={
            "entity_id": vehicle["id"],
            "title": "TEST_QA_Service_Duplicate",
            "date": str(date.today()),
            "mileage": 121000,
            "maintenance_ids": [mid, mid],
            "materials": [],
            "cost": 0,
        },
    )
    assert dup.status_code == 422

    bad_ref = _json(
        owner_session,
        "POST",
        "/service",
        payload={
            "entity_id": vehicle["id"],
            "title": "TEST_QA_Service_BadRef",
            "date": str(date.today()),
            "mileage": 121000,
            "maintenance_ids": ["00000000-0000-0000-0000-000000000000"],
            "materials": [],
            "cost": 0,
        },
    )
    assert bad_ref.status_code in (404, 422)

    pre_events = _json(owner_session, "GET", f"/service?entity_id={vehicle['id']}").json()
    pre_stock = _json(owner_session, "GET", f"/entities/{inv['id']}").json()["profile"]["quantity"]

    fail_stock = _json(
        owner_session,
        "POST",
        "/service",
        payload={
            "entity_id": vehicle["id"],
            "title": "TEST_QA_Service_TooMuchStock",
            "date": str(date.today()),
            "mileage": 121500,
            "maintenance_ids": [mid],
            "materials": [{"entity_id": inv["id"], "quantity": 999}],
            "cost": 999,
        },
    )
    assert fail_stock.status_code == 409
    assert fail_stock.json()["detail"] == "insufficient_stock"

    post_events = _json(owner_session, "GET", f"/service?entity_id={vehicle['id']}").json()
    post_stock = _json(owner_session, "GET", f"/entities/{inv['id']}").json()["profile"]["quantity"]
    assert len(post_events) == len(pre_events)
    assert post_stock == pre_stock


def test_service_rejects_future_completion_date(owner_session):
    vehicles = _json(owner_session, "GET", "/entities?entity_type=VEHICLE").json()
    vehicle = next(v for v in vehicles if v["name"] in ("TEST_QA_UI_Vehicle", "TEST_QA_Vehicle_VAQ"))
    future = date.today() + timedelta(days=2)
    resp = _json(
        owner_session,
        "POST",
        "/service",
        payload={
            "entity_id": vehicle["id"],
            "title": "TEST_QA_FUTURE_SERVICE",
            "date": str(future),
            "mileage": vehicle["profile"]["mileage"],
            "maintenance_ids": [],
            "materials": [],
            "cost": 0,
        },
    )
    assert resp.status_code == 422


def test_documents_upload_preview_and_multi_link(owner_session):
    entities = _json(owner_session, "GET", "/entities").json()
    vehicle = next(e for e in entities if e["name"] == "TEST_QA_UI_Vehicle")
    asset = next(e for e in entities if e["name"] == "TEST_QA_UI_Washer")

    pdf_bytes = _two_page_pdf_bytes()
    title = f"TEST_QA_Doc_Valid_{time.time_ns()}"
    headers = _auth_headers(owner_session)
    upload = owner_session.post(
        f"{BASE_URL}/api/documents",
        data={"title": title, "type": "MANUAL", "entity_id": vehicle["id"]},
        files={"file": ("test-qa.pdf", pdf_bytes, "application/pdf")},
        headers=headers,
    )
    assert upload.status_code == 201
    doc = upload.json()
    assert doc["title"] == title
    assert doc["content_type"] == "application/pdf"

    inline = owner_session.get(f"{BASE_URL}/api/documents/{doc['id']}/file")
    assert inline.status_code == 200
    assert inline.headers.get("content-type", "").startswith("application/pdf")

    linked = _json(owner_session, "POST", f"/documents/{doc['id']}/links", payload={"entity_id": asset["id"]})
    assert linked.status_code == 201

    docs = _json(owner_session, "GET", f"/documents?entity_id={asset['id']}")
    assert docs.status_code == 200
    assert any(d["id"] == doc["id"] for d in docs.json())

    archived = _json(owner_session, "POST", f"/documents/{doc['id']}/archive")
    assert archived.status_code == 200
    assert archived.json()["status"] == "ARCHIVED"


def test_documents_reject_malformed_pdf_without_db_writes(owner_session):
    bad_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    title = f"TEST_QA_BadPdf_{time.time_ns()}"
    sha = hashlib.sha256(bad_pdf).hexdigest()

    env = dotenv_values("/app/backend/.env")
    engine = create_engine(env["DATABASE_URL"])
    with engine.connect() as conn:
        docs_before = conn.execute(text("SELECT count(*) FROM documents WHERE title = :title"), {"title": title}).scalar_one()
        blobs_before = conn.execute(text("SELECT count(*) FROM file_blobs WHERE sha256 = :sha"), {"sha": sha}).scalar_one()

    entities = _json(owner_session, "GET", "/entities").json()
    vehicle = next(e for e in entities if e["name"] == "TEST_QA_UI_Vehicle")
    upload = owner_session.post(
        f"{BASE_URL}/api/documents",
        data={"title": title, "type": "MANUAL", "entity_id": vehicle["id"]},
        files={"file": ("legacy-malformed.pdf", bad_pdf, "application/pdf")},
        headers=_auth_headers(owner_session),
    )
    assert upload.status_code == 422
    assert upload.json()["detail"] == "invalid_file"

    with engine.connect() as conn:
        docs_after = conn.execute(text("SELECT count(*) FROM documents WHERE title = :title"), {"title": title}).scalar_one()
        blobs_after = conn.execute(text("SELECT count(*) FROM file_blobs WHERE sha256 = :sha"), {"sha": sha}).scalar_one()

    assert docs_after == docs_before
    assert blobs_after == blobs_before


def test_service_home_asset_with_mileage_without_maintenance_rejected(owner_session):
    entities = _json(owner_session, "GET", "/entities").json()
    asset = next(e for e in entities if e["name"] == "TEST_QA_UI_Washer")
    resp = _json(
        owner_session,
        "POST",
        "/service",
        payload={
            "entity_id": asset["id"],
            "title": f"TEST_QA_AssetMileage_{time.time_ns()}",
            "date": str(date.today()),
            "mileage": 123,
            "maintenance_ids": [],
            "materials": [],
            "cost": 0,
            "workshop": "",
            "notes": "",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["detail"] == "validation"


def test_components_manual_engine_is_not_generated(owner_session):
    vehicles = _json(owner_session, "GET", "/entities?entity_type=VEHICLE").json()
    selected = None
    components = []
    for vehicle in vehicles:
        detail = _json(owner_session, "GET", f"/entities/{vehicle['id']}")
        if detail.status_code != 200:
            continue
        cand = detail.json()["components"]
        if any(c.get("generated") is True for c in cand):
            selected = vehicle
            components = cand
            break

    if selected is None:
        locations = _json(owner_session, "GET", "/locations").json()
        assert locations
        created_vehicle = _json(
            owner_session,
            "POST",
            "/entities",
            payload={
                "entity_type": "VEHICLE",
                "name": f"TEST_QA_GeneratedVehicle_{time.time_ns()}",
                "location_id": locations[0]["id"],
                "vehicle": {
                    "manufacturer": "TEST",
                    "model": "GEN",
                    "mileage": 1,
                    "engine": "2.0",
                    "transmission": "MANUAL",
                    "drivetrain": "FWD",
                    "differential": "NONE",
                },
            },
        )
        assert created_vehicle.status_code == 201
        selected = created_vehicle.json()
        detail = _json(owner_session, "GET", f"/entities/{selected['id']}")
        assert detail.status_code == 200
        components = detail.json()["components"]

    manual_engine = next((c for c in components if c["name"] == "ENGINE" and c.get("generated") is False), None)
    if not manual_engine:
        created = _json(
            owner_session,
            "POST",
            f"/entities/{selected['id']}/components",
            payload={"name": "ENGINE", "kind": "ENGINE", "installed_at": str(date.today())},
        )
        assert created.status_code == 201
        created_data = created.json()
        assert created_data["name"] == "ENGINE"
        assert created_data["generated"] is False
