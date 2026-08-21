from fastapi.testclient import TestClient

from main import app


def test_health_loads_trained_model():
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["trained_model"]["loaded"] is True
    assert payload["trained_model"]["artifact"] == "goal_model.pkl"
