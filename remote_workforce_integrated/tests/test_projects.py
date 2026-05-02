from tests.conftest import get_token, auth_header


def test_create_project(client, manager_user):
    token = get_token(client, "manager@test.com", "manager123")
    resp = client.post("/api/projects/", headers=auth_header(token), json={
        "name": "Test Project",
        "description": "A test project"
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test Project"


def test_list_projects(client, manager_user):
    token = get_token(client, "manager@test.com", "manager123")
    client.post("/api/projects/", headers=auth_header(token), json={"name": "P1"})
    resp = client.get("/api/projects/", headers=auth_header(token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_create_project_employee_forbidden(client, employee_user):
    token = get_token(client, "employee@test.com", "employee123")
    resp = client.post("/api/projects/", headers=auth_header(token), json={"name": "Nope"})
    assert resp.status_code == 403
