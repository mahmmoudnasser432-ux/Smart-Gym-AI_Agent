import joblib
import pandas as pd
from pathlib import Path
from typing import Optional, Dict, Any

from macro_calculator import calculate_calories, calculate_macros
from gemini_client import generate_meal_plan
from adaptive_planner import compute_progress, format_progress_for_prompt
from biological_age import calculate_biological_age

# -----------------------------------------------
# Load model once at module level (cached in memory)
# -----------------------------------------------
_goal_model = None
MODEL_PATH = Path(__file__).resolve().parent / "goal_model.pkl"

def _get_model():
    global _goal_model
    if _goal_model is None:
        _goal_model = joblib.load(MODEL_PATH)
    return _goal_model


MODEL_FEATURES = [
    "age",
    "gender",
    "weight",
    "height",
    "bmi",
    "waist",
    "bodyfat_pct",
    "lean_mass",
    "activity_score",
    "sleep_quality",
    "calories",
    "protein",
    "carbs",
    "fat"
]

ACTIVITY_MAP = {
    "sedentary": 0,
    "light": 2,
    "moderate": 5,
    "active": 10,
    "athlete": 15
}


def encode_gender(g: str) -> int:
    if not isinstance(g, str):
        return 0
    g = g.strip().lower()
    if g in {"male", "m", "man"}:
        return 1
    return 0  # default female


def predict_goal(
    weight, height, age, gender,
    body_fat_pct, muscle_mass, waist_cm,
    activity_score, sleep_quality,
    maintenance_calories, maintenance_protein,
    maintenance_carbs, maintenance_fat
) -> str:

    bmi = weight / ((height / 100) ** 2)
    gender_encoded = encode_gender(gender)

    features = {
        "age": age,
        "gender": gender_encoded,
        "weight": weight,
        "height": height,
        "bmi": bmi,
        "waist": waist_cm,
        "bodyfat_pct": body_fat_pct,
        "lean_mass": muscle_mass,
        "activity_score": activity_score,
        "sleep_quality": sleep_quality,
        "calories": maintenance_calories,
        "protein": maintenance_protein,
        "carbs": maintenance_carbs,
        "fat": maintenance_fat
    }

    df = pd.DataFrame([features])[MODEL_FEATURES]

    return _get_model().predict(df)[0]


def full_agent(
    weight: float,
    height: float,
    age: int,
    gender: str,
    body_fat_mass: float,
    body_fat_pct: float,
    total_body_water: float,
    protein_mass: float,
    smm: float,
    visceral_fat: float,
    muscle_mass: float,
    bmr: float,
    activity_level: str = "moderate",
    training_frequency: int = 3,
    waist_cm: float = 90.0,
    allergies: str = "none",
    disease: str = "none",
    previous_scan: Optional[Dict[str, Any]] = None,
    budget: str = "moderate"
) -> tuple:

    activity_score = ACTIVITY_MAP.get(activity_level.lower(), 5)
    sleep_quality = 7  # Default if not collected from UI

    if bmr <= 0:
        if str(gender).lower() in ["male", "m", "man"]:
            bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5
        else:
            bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161
        bmr = max(1000.0, float(bmr))

    # Maintenance macros for ML model input
    m_calories = calculate_calories(bmr=bmr, activity_level=activity_level, goal="maintenance")
    m_macros = calculate_macros(weight=weight, calories=m_calories, goal="maintenance")

    ml_goal = predict_goal(
        weight=weight,
        height=height,
        age=age,
        gender=gender,
        body_fat_pct=body_fat_pct,
        muscle_mass=muscle_mass,
        waist_cm=waist_cm,
        activity_score=activity_score,
        sleep_quality=sleep_quality,
        maintenance_calories=m_calories,
        maintenance_protein=m_macros["protein"],
        maintenance_carbs=m_macros["carbs"],
        maintenance_fat=m_macros["fat"]
    )

    # ✅ ML model is the source of truth — use ml_goal for ALL calculations
    calories = calculate_calories(bmr=bmr, activity_level=activity_level, goal=ml_goal)
    macros = calculate_macros(weight=weight, calories=calories, goal=ml_goal)

    # Biological age
    bio_age = calculate_biological_age(
        chronological_age=age,
        gender=gender,
        weight_kg=weight,
        height_cm=height,
        body_fat_pct=body_fat_pct,
        smm_kg=smm,
        visceral_fat=int(visceral_fat),
        bmr=bmr,
    )

    # Build data dict for LLM
    data = {
        "weight": weight,
        "height": height,
        "age": age,
        "biological_age": bio_age,
        "gender": gender,
        "body_fat_pct": body_fat_pct,
        "body_fat_mass": body_fat_mass,
        "smm": smm,
        "muscle_mass": muscle_mass,
        "visceral_fat": visceral_fat,
        "bmr": bmr,
        "total_body_water": total_body_water,   # ← needed by InBody comparison card
        "goal": ml_goal,        # ml_goal IS the goal — no manual override
        "ml_goal": ml_goal,
        "calories": calories,
        "protein": macros["protein"],
        "carbs": macros["carbs"],
        "fat": macros["fat"],
        "training_frequency": training_frequency,
        "allergies": allergies,
        "disease": disease,
        "budget": budget,
        "progress_context": None  # default: no progress data
    }

    # ——— Adaptive Plan: inject progress if previous scan is available ———
    if previous_scan is not None:
        current_scan = {
            "weight": weight,
            "body_fat_mass": body_fat_mass,
            "body_fat_pct": body_fat_pct,
            "muscle_mass": muscle_mass,
            "smm": smm,
            "visceral_fat": visceral_fat,
            "bmr": bmr,
            "total_body_water": total_body_water,
        }
        progress = compute_progress(current_scan, previous_scan)
        data["progress_context"] = format_progress_for_prompt(progress)

    result = generate_meal_plan(data)

    return result, data


if __name__ == "__main__":

    plan, agent_data = full_agent(
        weight=100,
        height=175,
        age=30,
        gender="male",
        body_fat_mass=32,
        body_fat_pct=32,
        total_body_water=45,
        protein_mass=12,
        smm=35,
        visceral_fat=14,
        muscle_mass=35,
        bmr=1850
    )

    print(plan)
