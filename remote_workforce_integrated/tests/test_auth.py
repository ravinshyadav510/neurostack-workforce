from tests.conftest import get_token, auth_header


def test_login_success(client, admin_user):
    resp = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, admin_user):
    resp = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post("/api/auth/login", json={"email": "nobody@test.com", "password": "pass"})
    assert resp.status_code == 401
