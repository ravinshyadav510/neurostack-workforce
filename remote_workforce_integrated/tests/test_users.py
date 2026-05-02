from tests.conftest import get_token, auth_header


def test_get_me(client, employee_user):
    token = get_token(client, "employee@test.com", "employee123")
    resp = client.get("/api/users/me", headers=auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["email"] == "employee@test.com"


def test_list_users(client, admin_user, employee_user):
    token = get_token(client, "admin@test.com", "admin123")
    resp = client.get("/api/users/", headers=auth_header(token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


def test_create_user_as_admin(client, admin_user):
    token = get_token(client, "admin@test.com", "admin123")
    resp = client.post("/api/users/", headers=auth_header(token), json={
        "full_name": "New User",
        "email": "new@test.com",
        "password": "newpass123",
        "role": "employee"
    })
    assert resp.status_code == 200
    assert resp.json()["email"] == "new@test.com"


def test_create_user_as_employee_forbidden(client, employee_user):
    token = get_token(client, "employee@test.com", "employee123")
    resp = client.post("/api/users/", headers=auth_header(token), json={
        "full_name": "Hacker",
        "email": "hacker@test.com",
        "password": "hack123",
        "role": "admin"
    })
    assert resp.status_code == 403
