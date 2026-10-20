from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_health_endpoint_reports_demo_mode():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["data_mode"] == "synthetic_demo"


def test_events_are_explicitly_synthetic():
    response = client.get("/api/events")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 1
    assert payload["data_mode"] == "synthetic_demo"
    assert all(item["demo"] is True for item in payload["items"])


def test_status_endpoint_rejects_unknown_event():
    response = client.patch("/api/alerts/99999/status", json={"status": "Resolved"})
    assert response.status_code == 404
