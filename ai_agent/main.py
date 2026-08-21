from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import uvicorn
import os
import sys

# Fix for printing emojis on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Import the main agent function
from full_smart_agent import MODEL_PATH, _get_model, full_agent

app = FastAPI(title="SmartGym AI Server", description="AI Endpoint for Gym Node Backend")

# ─── CORS ────────────────────────────────────────────────────────────────────
# Allow all origins so the web frontend and Node.js can reach this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PlanRequest(BaseModel):
    weight: float
    height: float
    age: int
    gender: str
    body_fat_mass: float
    body_fat_pct: float
    total_body_water: float
    protein_mass: float
    smm: float
    visceral_fat: float
    muscle_mass: float
    bmr: float
    activity_level: str = "moderate"
    training_frequency: int = 3
    waist_cm: float = 90.0
    allergies: str = "none"
    disease: str = "none"
    previous_scan: Optional[Dict[str, Any]] = None
    budget: str = "moderate"

@app.get("/health")
def health_check():
    model = _get_model()
    return {
        "status": "ok",
        "trained_model": {
            "loaded": True,
            "type": type(model).__name__,
            "artifact": MODEL_PATH.name
        },
        "gemini": {
            "configured": bool(os.environ.get("GEMINI_API_KEY"))
        }
    }

def _run_agent(request: PlanRequest):
    """Shared logic for both route paths."""
    plan_text, plan_data = full_agent(
        weight=request.weight,
        height=request.height,
        age=request.age,
        gender=request.gender,
        body_fat_mass=request.body_fat_mass,
        body_fat_pct=request.body_fat_pct,
        total_body_water=request.total_body_water,
        protein_mass=request.protein_mass,
        smm=request.smm,
        visceral_fat=request.visceral_fat,
        muscle_mass=request.muscle_mass,
        bmr=request.bmr,
        activity_level=request.activity_level,
        training_frequency=request.training_frequency,
        waist_cm=request.waist_cm,
        allergies=request.allergies,
        disease=request.disease,
        previous_scan=request.previous_scan,
        budget=request.budget
    )
    
    # --- Parse the Markdown text into structured JSON ---
    from pdf_exporter import _parse_plan, _parse_option
    import re
    
    raw_sections = _parse_plan(plan_text)
    structured_meals = []
    
    for meal_name in ["BREAKFAST", "SNACK 1", "LUNCH", "SNACK 2", "DINNER"]:
        if meal_name in raw_sections:
            options = []
            for line in raw_sections[meal_name]:
                opt_m = re.match(r"\[([ABC])\]\s*(.+)", line)
                if opt_m:
                    letter = opt_m.group(1)
                    parsed = _parse_option(opt_m.group(2))
                    parsed["option"] = letter
                    options.append(parsed)
            if options:
                structured_meals.append({
                    "meal_name": meal_name,
                    "options": options
                })
                
    # Parse Workout Plan into Days and Exercises
    raw_workout = raw_sections.get("WORKOUT PLAN", [])
    structured_workout = []
    current_day = None
    
    for line in raw_workout:
        line = line.strip()
        if not line:
            continue
        # If it doesn't start with a bullet point, treat it as a Day Header
        if not line.startswith(("-", "•", "*")):
            current_day = {
                "day_name": line,
                "exercises": []
            }
            structured_workout.append(current_day)
        else:
            # It's an exercise under the current day
            clean_ex = line.lstrip("-•* ").strip()
            if current_day is not None:
                current_day["exercises"].append(clean_ex)
            else:
                # Edge case if AI forgets day header
                current_day = {"day_name": "Workout Exercises", "exercises": [clean_ex]}
                structured_workout.append(current_day)

    # Clean up Coach Notes (remove leading bullets)
    raw_notes = raw_sections.get("COACH NOTES", [])
    structured_notes = []
    for note in raw_notes:
        clean_note = note.lstrip("-•* ").strip()
        if clean_note:
            structured_notes.append(clean_note)
                
    parsed_plan = {
        "daily_target": {
            "calories": plan_data.get("calories", "--"),
            "protein": plan_data.get("protein", plan_data.get("protein_g", "--")),
            "carbs": plan_data.get("carbs", plan_data.get("carbs_g", "--")),
            "fat": plan_data.get("fat", plan_data.get("fats_g", "--"))
        },
        "meals": structured_meals,
        "workout_plan": structured_workout,
        "coach_notes": structured_notes
    }

    # ── Build unified response ────────────────────────────────────────────────
    # We return BOTH "plan_data" and "agent_data" pointing to the same dict
    # because the Node.js backend and Flutter clients use different key names.
    # "plan_data"  ← used by the Streamlit UI
    # "agent_data" ← used by the Node.js middleware and Flutter apps
    return {
        "status": "success",
        "plan_text": plan_text,
        "plan_data": plan_data,    # Streamlit UI reads this
        "agent_data": plan_data,   # Node.js + Flutter read this
        "parsed_plan": parsed_plan
    }


@app.post("/api/generate-plan")
def generate_plan_with_prefix(request: PlanRequest):
    """
    Endpoint with /api/ prefix — used by the Streamlit UI.
    """
    print(f"\n==============================================")
    print(f"🏋️  [AI LOG] Received Generate Plan Request via /api/generate-plan")
    print(f"👤  User Data: Weight {request.weight}kg, Height {request.height}cm, Age {request.age}")
    print(f"==============================================\n")
    try:
        return _run_agent(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-plan")
def generate_plan(request: PlanRequest):
    """
    Endpoint WITHOUT /api/ prefix — used by the BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:3000").
    """
    print(f"\n==============================================")
    print(f"🏋️  [AI LOG] Received Generate Plan Request via /generate-plan")
    print(f"👤  User Data: Weight {request.weight}kg, Height {request.height}cm, Age {request.age}")
    print(f"==============================================\n")
    try:
        res = _run_agent(request)
        print(f"\n✅  [AI LOG] Plan generated successfully and sent back to backend!")
        return res
    except Exception as e:
        print(f"\n❌  [AI LOG] Error generating plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Chatbot Endpoint ────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    question: str
    history: Optional[List[Dict[str, str]]] = None
    context: Optional[Dict[str, Any]] = None

@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    """
    Chatbot endpoint for Node.js
    """
    from gemini_chatbot import gym_chatbot
    try:
        reply = gym_chatbot(
            question=request.question,
            history=request.history,
            context=request.context
        )
        return {"status": "success", "reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── PDF Generation Endpoint ─────────────────────────────────────────────────
class PdfRequest(BaseModel):
    weight: float
    height: float
    age: int
    biological_age: Optional[int] = None   # ← optional: Node.js DB may store null
    gender: str
    body_fat_pct: float
    body_fat_mass: float
    muscle_mass: float
    smm: float
    visceral_fat: float
    bmr: float
    total_body_water: float
    goal: str
    calories: float
    protein: float
    carbs: float
    fat: float
    plan_text: str

@app.post("/generate-pdf")
def generate_pdf_endpoint(request: PdfRequest):
    """
    Generate PDF report endpoint. Returns raw PDF bytes.
    biological_age is optional — falls back to chronological age if not provided.
    """
    from pdf_exporter import generate_pdf_report
    try:
        # Fall back to chronological age if biological_age was not stored in DB
        bio_age = request.biological_age if request.biological_age is not None else request.age
        pdf_bytes = generate_pdf_report(
            weight=request.weight,
            height=request.height,
            age=request.age,
            biological_age=bio_age,
            gender=request.gender,
            body_fat_pct=request.body_fat_pct,
            body_fat_mass=request.body_fat_mass,
            muscle_mass=request.muscle_mass,
            smm=request.smm,
            visceral_fat=request.visceral_fat,
            bmr=request.bmr,
            total_body_water=request.total_body_water,
            goal=request.goal,
            calories=request.calories,
            protein=request.protein,
            carbs=request.carbs,
            fat=request.fat,
            plan_text=request.plan_text
        )
        return Response(content=pdf_bytes, media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Binds to all network interfaces on port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000)


