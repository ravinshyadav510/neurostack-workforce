from app.models.models import ActivityLog
from tests.conftest import get_token, auth_header


def test_login_creates_activity_log(client, db, admin_user):
    client.post("/api/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    logs = db.query(ActivityLog).filter(ActivityLog.action == "user_login").all()
    assert len(logs) >= 1
    assert "admin@test.com" in logs[0].details


def test_task_create_creates_activity_log(client, db, manager_user, employee_user):
    token = get_token(client, "manager@test.com", "manager123")
    client.post("/api/tasks/", headers=auth_header(token), json={
        "title": "Logged Task",
        "assigned_to_id": employee_user.id
    })
    logs = db.query(ActivityLog).filter(ActivityLog.action == "task_created").all()
    assert len(logs) >= 1
    assert "Logged Task" in logs[0].details
