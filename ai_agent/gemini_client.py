"""
gemini_client.py
----------------
Google Gemini integration for MuscleForge AI.
Uses the modern `google.genai` SDK (not the deprecated `google.generativeai`).
Replaces the old Ollama/LLaMA local model with Google's cloud API.

Two main entry points:
  - generate_meal_plan(data)  → used by full_smart_agent.py
  - query_gemini(prompt)      → used by gemini_chatbot.py
"""

import os
import re
import sys
from typing import Dict, Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

# -----------------------------------
# SECURE API KEY LOADING
# -----------------------------------

load_dotenv()  # Load from .env file in project root

_API_KEY = os.environ.get("GEMINI_API_KEY")

# -----------------------------------
# MODEL CONFIGURATION
# -----------------------------------

SYSTEM_INSTRUCTION = (
    "أنت AI Agent مخصص لإدارة Smart Gym. "
    "مهامك الأساسية: بناء workout & meal plan مخصصة "
    "وترد على الناس في ai chat bot بس في مجال الجيم فقط. "
    "خلي إجاباتك دقيقة ومحفزة."
)

MODEL_NAME = "gemini-2.5-flash"  # 2.5-pro free tier has limit 0, using flash with rate limit delay

_client = None


def get_client():
    global _client
    if _client is None:
        if not _API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=_API_KEY)
    return _client


# -----------------------------------
# CORE QUERY FUNCTION
# -----------------------------------

def query_gemini(prompt: str, timeout: int = 120) -> str:
    """
    Send a single prompt to Gemini and return the text response.
    Fires immediately on the standard/paid tier; backs off only when the API
    actually returns a 429/503 rate-limit error.
    """
    import time
    import re
    max_retries = 4
    for attempt in range(max_retries):
        try:
            response = get_client().models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.3,
                    top_p=0.9,
                ),
            )
            return response.text.strip()

        except Exception as e:
            error_msg = str(e).lower()
            if "quota" in error_msg or "rate" in error_msg or "429" in error_msg or "503" in error_msg:
                # Honour the server-suggested "retry in Xs" when present, else a short
                # exponential backoff. Capped so total wait stays well under the gateway
                # timeout (previously 35s x 3 = 105s, which timed the request out).
                suggested = re.search(r"retry in ([0-9.]+)s", str(e))
                delay = min((float(suggested.group(1)) + 1) if suggested else (2 ** attempt + 1), 10)
                print(f"⚠️ Gemini rate limit (429/503). Retry {attempt + 1}/{max_retries} in {delay:.1f}s...")
                time.sleep(delay)
                continue
                
            print(f"[Gemini ERROR] {type(e).__name__}: {e}")
            if "timeout" in error_msg or "deadline" in error_msg:
                return "⚠️ The AI server took too long to respond. Please try again in a few seconds."
            if "api key" in error_msg or "authentication" in error_msg:
                return "⚠️ API authentication failed. Please verify your GEMINI_API_KEY in the .env file."
            if "not found" in error_msg or "404" in error_msg:
                return "⚠️ The AI model is not available. Please check the model name in gemini_client.py."
            if "safety" in error_msg or "blocked" in error_msg:
                return "⚠️ The AI could not process this request due to content safety filters. Please rephrase your question."
            
            return "⚠️ Something went wrong while generating the AI response. Please try again."

    return "⚠️ API rate limit reached and maximum retries exhausted. Please wait a minute and try again."


# -----------------------------------
# PROMPT BUILDERS (split into 2)
# -----------------------------------

def build_mealplan_prompt(data: Dict[str, Any]) -> str:
    """Builds the MEAL PLAN only prompt — no workout section."""

    progress_section = ""
    if data.get("progress_context"):
        progress_section = data["progress_context"]

    prompt = f"""You are MuscleForge AI — a professional sports nutritionist.
Be CONCISE. Respond in English only. No lengthy explanations. No filler text.

USER PROFILE
Weight: {data.get("weight")} kg | Height: {data.get("height")} cm | Age: {data.get("age")} | Bio Age: {data.get("biological_age")} yrs | Gender: {data.get("gender")}
Goal: {data.get("goal")} | BMR: {data.get("bmr")} kcal
Budget: {data.get("budget", "moderate")} | Allergies: {data.get("allergies", "none")} | Conditions: {data.get("disease", "none")}

CRITICAL MEDICAL SAFETY:
If Conditions is NOT "none", you MUST:
1. Acknowledge the condition explicitly.
2. Modify meal choices and macros to be safe for that condition.
3. Flag any foods/supplements contraindicated for that condition.
4. Add a note recommending the user consult their physician before starting.
Common examples: diabetes → limit sugar/refined carbs; hypertension → low sodium; kidney disease → limit protein; celiac → gluten-free only; lactose intolerance → no dairy.

DAILY TARGETS: {data.get("calories")} kcal | Protein: {data.get("protein")} g | Carbs: {data.get("carbs")} g | Fat: {data.get("fat")} g
{progress_section}
BUDGET RULE:
- low: eggs, oats, rice, lentils, sardines, potato, banana, whole wheat bread, milk, frozen veg
- moderate: chicken breast, tuna, rice, oats, potato, eggs, greek yogurt, almonds
- high: salmon, beef, quinoa, avocado, greek yogurt, nuts, berries, protein variety

OUTPUT FORMAT:

DAILY TARGET
{data.get("calories")} kcal | P: {data.get("protein")}g | C: {data.get("carbs")}g | F: {data.get("fat")}g

MEAL PLAN

You must provide EXACTLY 5 meals in this order:
=== BREAKFAST ===
=== SNACK 1 ===
=== LUNCH ===
=== SNACK 2 ===
=== DINNER ===

Under each meal header, provide EXACTLY 3 options using this exact syntax:
[A] Meal Name | Ingredients with grams | 400 kcal | P:30g C:40g F:10g
[B] Meal Name | Ingredients with grams | 400 kcal | P:30g C:40g F:10g
[C] Meal Name | Ingredients with grams | 400 kcal | P:30g C:40g F:10g

STRICT RULES:
1. Metric units only. Max 4 ingredients per option.
2. Produce a COMPLETE meal plan containing ALL 5 meals: BREAKFAST, SNACK 1, LUNCH, SNACK 2, DINNER.
3. Output ONLY the meal plan text, nothing else."""

    return prompt


def build_workout_prompt(data: Dict[str, Any]) -> str:
    """Builds the WORKOUT PLAN + COACH NOTES only prompt."""

    training_days = int(data.get("training_frequency", 3))

    # Build explicit day schedule based on frequency
    day_schedule_map = {
        1: "Day 1 — Full Body",
        2: "Day 1 — Upper Body\nDay 2 — Lower Body",
        3: "Day 1 — Push (Chest, Shoulders, Triceps)\nDay 2 — Pull (Back, Biceps)\nDay 3 — Legs & Core",
        4: "Day 1 — Chest & Triceps\nDay 2 — Back & Biceps\nDay 3 — Shoulders & Arms\nDay 4 — Legs & Core",
        5: "Day 1 — Chest & Triceps\nDay 2 — Back & Biceps\nDay 3 — Shoulders\nDay 4 — Legs\nDay 5 — Arms & Core",
        6: "Day 1 — Chest\nDay 2 — Back\nDay 3 — Shoulders\nDay 4 — Legs\nDay 5 — Arms\nDay 6 — Core & Cardio",
        7: "Day 1 — Chest\nDay 2 — Back\nDay 3 — Shoulders\nDay 4 — Legs\nDay 5 — Arms\nDay 6 — Core & Cardio\nDay 7 — Active Recovery",
    }
    schedule_hint = day_schedule_map.get(training_days, f"{training_days} training days")

    prompt = f"""You are MuscleForge AI — an expert gym coach and personal trainer.
Respond in English only. Be direct and specific. No filler text.

USER PROFILE
Weight: {data.get("weight")} kg | Age: {data.get("age")} | Gender: {data.get("gender")}
Goal: {data.get("goal")} | Training: {training_days} days/week
Body Fat: {data.get("body_fat_pct")}% | SMM: {data.get("smm")} kg | BMR: {data.get("bmr")} kcal
Conditions: {data.get("disease", "none")} | Allergies: {data.get("allergies", "none")}

TASK: Generate a complete {training_days}-day workout program. You MUST output ALL {training_days} days — do NOT stop early.

Suggested split for {training_days} days:
{schedule_hint}

OUTPUT FORMAT — follow EXACTLY, output ONLY this:

WORKOUT PLAN
Day 1 — <Muscle Focus>
- <Exercise> — <sets> x <reps>
- <Exercise> — <sets> x <reps>
- <Exercise> — <sets> x <reps>
- <Exercise> — <sets> x <reps>
- <Exercise> — <sets> x <reps>

Day 2 — <Muscle Focus>
- <Exercise> — <sets> x <reps>
- <Exercise> — <sets> x <reps>
- <Exercise> — <sets> x <reps>
- <Exercise> — <sets> x <reps>
- <Exercise> — <sets> x <reps>

(continue for ALL {training_days} days in the same format)

COACH NOTES
- <note about nutrition timing or recovery>
- <note about progressive overload or form>
- <note about rest days or sleep>

STRICT RULES:
- Output ALL {training_days} workout days with EXACTLY 5 exercises each.
- Use "Day N — Focus" format for each day header. No deviations.
- If user has medical conditions, avoid exercises that stress the affected area.
- Adapt exercise selection to the goal: fat_loss → higher reps (12-15); muscle_gain → heavier (6-10 reps); balanced → moderate (8-12 reps)."""

    return prompt


# -----------------------------------
# MAIN FUNCTION USED BY AGENT
# -----------------------------------

def generate_meal_plan(data: Dict[str, Any]) -> str:
    """
    Generate meal plan and workout plan as two separate Gemini calls,
    then combine into one output string.
    This prevents token limits from cutting the workout plan.
    """
    # Call 1: Meal Plan only
    meal_prompt = build_mealplan_prompt(data)
    meal_result = query_gemini(meal_prompt)

    # Call 2: Workout Plan + Coach Notes only
    workout_prompt = build_workout_prompt(data)
    workout_result = query_gemini(workout_prompt)

    # Strip any accidental leading/trailing whitespace from each
    meal_result = meal_result.strip()
    workout_result = workout_result.strip()

    # Combine: ensure WORKOUT PLAN header is not duplicated if model included it
    # Remove any duplicate DAILY TARGET or MEAL PLAN headers from workout result
    workout_cleaned = re.sub(
        r"^(DAILY TARGET|MEAL PLAN|=== .+ ===).*\n?",
        "", workout_result, flags=re.MULTILINE
    )
    workout_cleaned = workout_cleaned.strip()

    # Ensure the workout section starts with WORKOUT PLAN
    if not re.match(r"^WORKOUT PLAN", workout_cleaned, re.IGNORECASE):
        workout_cleaned = "WORKOUT PLAN\n" + workout_cleaned

    combined = meal_result + "\n\n" + workout_cleaned
    return combined


# -----------------------------------
# TEST MODE
# -----------------------------------

if __name__ == "__main__":

    test_data = {
        "weight": 90,
        "height": 178,
        "age": 28,
        "gender": "male",
        "biological_age": 30,
        "goal": "fat_loss",
        "training_frequency": 5,
        "body_fat_pct": 18,
        "body_fat_mass": 12,
        "smm": 32,
        "muscle_mass": 60,
        "visceral_fat": 8,
        "bmr": 1700,
        "calories": 2000,
        "protein": 150,
        "carbs": 200,
        "fat": 60,
        "budget": "moderate",
        "allergies": "none",
        "disease": "none",
    }

    print("=" * 60)
    print("  Testing Gemini — MuscleForge AI")
    print(f"  Model: {MODEL_NAME}")
    print("=" * 60)

    print("\n[1/3] Testing simple query...")
    simple = query_gemini("Say 'Gemini is connected!' in one line.")
    print(f"  -> {simple}")


    print("\n[2/3] Generating meal plan (call 1)...")
    meal = query_gemini(build_mealplan_prompt(test_data))
    print("=== MEAL OUTPUT (first 500 chars) ===")
    print(meal[:500])

    print("\n[3/3] Generating workout plan (call 2)...")
    workout = query_gemini(build_workout_prompt(test_data))
    print("=== WORKOUT OUTPUT (first 800 chars) ===")
    print(workout[:800])

    print("\n✅ All tests passed!")
