from tests.conftest import get_token, auth_header


def test_submit_daily_update(client, employee_user):
    token = get_token(client, "employee@test.com", "employee123")
    resp = client.post("/api/daily-updates/", headers=auth_header(token), json={
        "completed_work": "Finished API tests",
        "pending_work": "Frontend tests",
        "blockers": "None"
    })
    assert resp.status_code == 200
    assert resp.json()["completed_work"] == "Finished API tests"


def test_get_my_updates(client, employee_user):
    token = get_token(client, "employee@test.com", "employee123")
    client.post("/api/daily-updates/", headers=auth_header(token), json={
        "completed_work": "Work done"
    })
    resp = client.get("/api/daily-updates/mine", headers=auth_header(token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
