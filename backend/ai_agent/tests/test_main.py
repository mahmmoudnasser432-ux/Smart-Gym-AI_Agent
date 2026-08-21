from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "main.py"

spec = spec_from_file_location("smartgym_ai_agent_main", MODULE_PATH)
main = module_from_spec(spec)
sys.modules[spec.name] = main
spec.loader.exec_module(main)

client = TestClient(main.app)


def test_root_endpoint_returns_running_status():
    response = client.get("/")

    assert response.status_code == 200
    assert "running" in response.json()["status"].lower()


def test_health_endpoint_returns_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_generate_plan_returns_calculated_plan_data():
    payload = {
        "weight": 92,
        "height": 180,
        "age": 35,
        "gender": "male",
        "body_fat_pct": 28,
        "smm": 33,
        "visceral_fat": 12,
        "activity_level": "active",
        "allergies": "none",
        "disease": "none",
    }

    response = client.post("/generate-plan", json=payload)

    assert response.status_code == 200
    data = response.json()
    bmi = main.calculate_bmi(payload["weight"], payload["height"])
    goal = main.predict_goal(payload["body_fat_pct"], bmi)
    calories = main.calculate_calories(
        payload["weight"],
        payload["height"],
        payload["age"],
        payload["gender"],
        payload["activity_level"],
        goal,
    )
    macros = main.calculate_macros(calories, payload["weight"], goal)
    bio_age = main.calculate_biological_age(
        age=payload["age"],
        gender=payload["gender"],
        body_fat_pct=payload["body_fat_pct"],
        smm=payload["smm"],
        visceral_fat=payload["visceral_fat"],
        bmi=bmi,
    )

    assert data["goal"] == goal
    assert data["biological_age"] == bio_age
    assert data["calories"] == calories
    assert data["protein"] == macros["protein"]
    assert data["fat"] == macros["fat"]
    assert data["carbs"] == macros["carbs"]
    assert "fat_loss" in data["plan_text"]


def test_generate_plan_rejects_missing_required_fields():
    response = client.post(
        "/generate-plan",
        json={"weight": 80, "height": 175, "age": 25},
    )

    assert response.status_code == 422


def test_chat_returns_reply_for_message():
    payload = {
        "message": "How do I improve my squat?",
        "history": [{"role": "user", "content": "I train twice a week"}],
        "user_id": 12,
    }

    response = client.post("/chat", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert "squat" in data["reply"].lower()


def test_biological_age_returns_expected_value():
    payload = {
        "age": 30,
        "gender": "female",
        "weight": 68,
        "height": 165,
        "body_fat_pct": 20,
        "smm": 31,
        "visceral_fat": 4,
    }

    response = client.post("/biological-age", json=payload)

    assert response.status_code == 200
    bmi = main.calculate_bmi(payload["weight"], payload["height"])
    expected = main.calculate_biological_age(
        age=payload["age"],
        gender=payload["gender"],
        body_fat_pct=payload["body_fat_pct"],
        smm=payload["smm"],
        visceral_fat=payload["visceral_fat"],
        bmi=bmi,
    )
    assert response.json() == {"biological_age": expected}


def test_progress_analysis_returns_scan_differences():
    payload = {
        "current_scan": {
            "weight": 81.4,
            "body_fat_pct": 18.1,
            "muscle_mass": 39.7,
            "bmi": 26.2,
        },
        "previous_scan": {
            "weight": 84.0,
            "body_fat_pct": 20.6,
            "muscle_mass": 37.9,
            "bmi": 27.0,
        },
    }

    response = client.post("/progress-analysis", json=payload)

    assert response.status_code == 200
    assert response.json() == {
        "weight_change": -2.6,
        "fat_change": -2.5,
        "muscle_change": 1.8,
        "bmi_change": -0.8,
        "summary": "Progress tracked successfully",
    }


def test_generate_report_returns_pdf_response():
    response = client.post("/generate-report", json={"plan_id": 55, "user_id": 7})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert 'attachment; filename=report_55.pdf' == response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-1.4")
