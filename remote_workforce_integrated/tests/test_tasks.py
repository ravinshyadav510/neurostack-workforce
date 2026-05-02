from tests.conftest import get_token, auth_header


def test_create_task(client, manager_user, employee_user):
    token = get_token(client, "manager@test.com", "manager123")
    resp = client.post("/api/tasks/", headers=auth_header(token), json={
        "title": "Test Task",
        "description": "A test task",
        "priority": "high",
        "assigned_to_id": employee_user.id
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test Task"
    assert data["status"] == "pending"


def test_create_task_employee_forbidden(client, employee_user):
    token = get_token(client, "employee@test.com", "employee123")
    resp = client.post("/api/tasks/", headers=auth_header(token), json={
        "title": "Bad Task",
        "assigned_to_id": employee_user.id
    })
    assert resp.status_code == 403


def test_list_tasks(client, manager_user, employee_user):
    token = get_token(client, "manager@test.com", "manager123")
    client.post("/api/tasks/", headers=auth_header(token), json={
        "title": "Task 1",
        "assigned_to_id": employee_user.id
    })
    resp = client.get("/api/tasks/", headers=auth_header(token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_update_task_status(client, manager_user, employee_user):
    token = get_token(client, "manager@test.com", "manager123")
    create_resp = client.post("/api/tasks/", headers=auth_header(token), json={
        "title": "Status Task",
        "assigned_to_id": employee_user.id
    })
    task_id = create_resp.json()["id"]

    emp_token = get_token(client, "employee@test.com", "employee123")
    resp = client.put(f"/api/tasks/{task_id}", headers=auth_header(emp_token), json={
        "status": "in_progress"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"


def test_delete_task(client, manager_user, employee_user):
    token = get_token(client, "manager@test.com", "manager123")
    create_resp = client.post("/api/tasks/", headers=auth_header(token), json={
        "title": "Delete Me",
        "assigned_to_id": employee_user.id
    })
    task_id = create_resp.json()["id"]

    resp = client.delete(f"/api/tasks/{task_id}", headers=auth_header(token))
    assert resp.status_code == 200
