"""
SmartGym AI Agent — FastAPI Server (Gemini 2.5 Flash)
====================================================
الـ 5 endpoints اللي بيكلمها الـ Node.js Backend:
  POST /generate-plan
  POST /chat
  POST /biological-age
  POST /progress-analysis
  POST /generate-report
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Any
import uvicorn
import httpx
import os
import re

from dotenv import load_dotenv
from google import genai
from google.genai import types

# ══════════════════════════════════════════════════════════════════
# 🔑 Secure API Key Loading
# ══════════════════════════════════════════════════════════════════

load_dotenv()

_API_KEY = os.environ.get("GEMINI_API_KEY")
if not _API_KEY:
    raise RuntimeError(
        "\n❌ GEMINI_API_KEY is missing!\n"
        "Create a .env file with: GEMINI_API_KEY=your_key_here\n"
        "Get your key from: https://aistudio.google.com/apikey"
    )

SYSTEM_INSTRUCTION = (
    "أنت AI Agent مخصص لإدارة Smart Gym. "
    "مهامك الأساسية: بناء workout & meal plan مخصصة "
    "وترد على الناس في ai chat bot بس في مجال الجيم فقط. "
    "خلي إجاباتك دقيقة ومحفزة."
)

MODEL_NAME = "gemini-2.5-flash"

# Create the Gemini client using the modern SDK
_client = genai.Client(api_key=_API_KEY)

app = FastAPI(title="SmartGym AI Agent", version="2.0.0")


# ══════════════════════════════════════════════════════════════════
# 📦 Request / Response Models
# ══════════════════════════════════════════════════════════════════

class GeneratePlanRequest(BaseModel):
    weight: float
    height: float
    age: int
    gender: str
    body_fat_mass: Optional[float] = None
    body_fat_pct: Optional[float] = None
    muscle_mass: Optional[float] = None
    smm: Optional[float] = None
    visceral_fat: Optional[float] = None
    bmr: Optional[float] = None
    total_body_water: Optional[float] = None
    activity_level: Optional[str] = "moderate"
    training_frequency: Optional[int] = 3
    allergies: Optional[str] = "none"
    disease: Optional[str] = "none"


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Any]] = Field(default_factory=list)
    user_id: Optional[int] = None


class BiologicalAgeRequest(BaseModel):
    age: int
    gender: str
    weight: float
    height: float
    body_fat_pct: Optional[float] = None
    smm: Optional[float] = None
    visceral_fat: Optional[float] = None
    bmr: Optional[float] = None


class ProgressAnalysisRequest(BaseModel):
    current_scan: dict
    previous_scan: dict


class GenerateReportRequest(BaseModel):
    plan_id: str
    user_id: Optional[int] = None


from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

class GeneratePdfRequest(BaseModel):
    weight: float
    height: float
    age: int
    biological_age: Optional[int] = None
    gender: str
    body_fat_pct: Optional[float] = None
    body_fat_mass: Optional[float] = None
    muscle_mass: Optional[float] = None
    smm: Optional[float] = None
    visceral_fat: Optional[float] = None
    bmr: Optional[float] = None
    total_body_water: Optional[float] = None
    goal: str
    calories: int
    protein: int
    carbs: int
    fat: int
    plan_text: str

class InbodyRequest(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None


# ══════════════════════════════════════════════════════════════════
# 🧠 Helper Functions
# ══════════════════════════════════════════════════════════════════

def _query_gemini(prompt: str, timeout: int = 120) -> str:
    """Send a prompt to Gemini using the google-genai SDK."""
    try:
        response = _client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.3,
                top_p=0.9,
                max_output_tokens=4096,
            ),
        )
        return response.text.strip()
    except Exception as e:
        error_msg = str(e).lower()
        if "quota" in error_msg or "rate" in error_msg or "429" in error_msg:
            raise HTTPException(
                status_code=429,
                detail="API rate limit reached. Please wait and try again."
            )
        if "timeout" in error_msg or "deadline" in error_msg:
            raise HTTPException(
                status_code=504,
                detail="AI server took too long to respond. Please try again."
            )
        print(f"[Gemini ERROR] {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI generation failed: {type(e).__name__}"
        )


def predict_goal(body_fat_pct: float, bmi: float) -> str:
    """بيحدد الهدف تلقائياً من بيانات الجسم"""
    if body_fat_pct and body_fat_pct >= 25:
        return "fat_loss"
    if bmi and bmi < 21:
        return "muscle_gain"
    return "balanced"


def calculate_bmi(weight: float, height: float) -> float:
    """حساب الـ BMI"""
    height_m = height / 100
    return round(weight / (height_m ** 2), 2)


def calculate_calories(weight: float, height: float, age: int,
                        gender: str, activity_level: str, goal: str) -> int:
    """حساب السعرات الحرارية اليومية"""
    if gender.lower() == "male":
        bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)

    activity_factors = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9
    }
    tdee = bmr * activity_factors.get(activity_level, 1.55)

    if goal == "fat_loss":
        return int(tdee - 500)
    elif goal == "muscle_gain":
        return int(tdee + 300)
    return int(tdee)


def calculate_macros(calories: int, weight: float, goal: str) -> dict:
    """حساب الـ macros"""
    protein = int(weight * 2.2)
    fat = int(calories * 0.25 / 9)
    carbs = int((calories - (protein * 4) - (fat * 9)) / 4)
    return {"protein": protein, "carbs": max(30, carbs), "fat": fat}


def calculate_biological_age(age: int, gender: str, body_fat_pct: float,
                               smm: float, visceral_fat: float, bmi: float) -> int:
    """حساب العمر البيولوجي"""
    bio_age = age

    if body_fat_pct:
        if gender.lower() == "male":
            if body_fat_pct > 25:
                bio_age += 3
            elif body_fat_pct < 15:
                bio_age -= 2
        else:
            if body_fat_pct > 33:
                bio_age += 3
            elif body_fat_pct < 22:
                bio_age -= 2

    if visceral_fat:
        if visceral_fat > 10:
            bio_age += 2
        elif visceral_fat < 5:
            bio_age -= 1

    if smm and smm > 30:
        bio_age -= 1

    return max(18, bio_age)


# ══════════════════════════════════════════════════════════════════
# 🔌 API Endpoints
# ══════════════════════════════════════════════════════════════════

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:3000")


@app.get("/")
def root():
    return {"status": f"SmartGym AI Agent is running ✅ ({MODEL_NAME})"}


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}


# ─── 0. Fetch InBody Data from Backend ──────────────────────────
@app.post("/inbody")
def get_inbody(data: InbodyRequest):
    """
    يجيب أحدث InBody scan للـ user من الـ Node.js backend
    بيستخدم الـ public endpoint (بدون JWT)
    """
    if not data.user_id and not data.email:
        raise HTTPException(status_code=400, detail="يجب توفير user_id أو email")

    params = {}
    if data.user_id:
        params["userId"] = data.user_id
    if data.email:
        params["email"] = data.email

    try:
        response = httpx.get(
            f"{BACKEND_URL}/api/ai/public/inbody/latest",
            params=params,
            timeout=10.0
        )
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="لا يوجد InBody scan لهذا المستخدم")
        if not response.is_success:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"لا يمكن الوصول للـ backend: {str(e)}")


# ─── 1. Generate Smart Plan (Gemini-powered) ─────────────────────
@app.post("/generate-plan")
def generate_plan(data: GeneratePlanRequest):
    """
    الـ endpoint الأهم — بيولد الخطة الكاملة باستخدام Gemini
    """
    print(f"\n==============================================")
    print(f"🏋️  [AI LOG] Received Generate Plan Request")
    print(f"👤  User Data: Weight {data.weight}kg, Height {data.height}cm, Age {data.age}, Goal ?")
    print(f"==============================================\n")
    try:
        bmi = calculate_bmi(data.weight, data.height)
        goal = predict_goal(data.body_fat_pct or 20, bmi)
        print(f"🎯  [AI LOG] Predicted Goal: {goal} | BMI: {bmi}")
        
        bio_age = calculate_biological_age(
            age=data.age,
            gender=data.gender,
            body_fat_pct=data.body_fat_pct or 20,
            smm=data.smm or 0,
            visceral_fat=data.visceral_fat or 0,
            bmi=bmi
        )
        calories = calculate_calories(
            data.weight, data.height, data.age,
            data.gender, data.activity_level or "moderate", goal
        )
        macros = calculate_macros(calories, data.weight, goal)
        print(f"📊  [AI LOG] Macros Calculated: {calories} kcal (P:{macros['protein']}g C:{macros['carbs']}g F:{macros['fat']}g)")

        training_days = data.training_frequency or 3
        goal_display = goal.replace("_", " ").title()

        # ─── Gemini Call 1: Meal Plan ───────────────────────────────
        print(f"⏳  [AI LOG] Calling Gemini for Meal Plan... (Wait 3-5 seconds)")
        meal_prompt = f"""You are MuscleForge AI — a professional sports nutritionist.
Be CONCISE. Respond in English only.

USER: Weight: {data.weight}kg | Height: {data.height}cm | Age: {data.age} | Gender: {data.gender}
Goal: {goal_display} | Calories: {calories}kcal | P:{macros['protein']}g C:{macros['carbs']}g F:{macros['fat']}g
Allergies: {data.allergies or 'none'} | Conditions: {data.disease or 'none'}

Generate a 5-meal plan (Breakfast, Snack1, Lunch, Snack2, Dinner) with 3 options each (A/B/C).
Format each option: [A] <name> | <ingredients with grams> | <kcal> kcal | P:<g>g C:<g>g F:<g>g
Use === MEAL NAME === headers. Max 4 ingredients per option. Metric units only."""

        meal_plan_text = _query_gemini(meal_prompt)
        print(f"✅  [AI LOG] Meal Plan Generated successfully.")

        # ─── Gemini Call 2: Workout Plan ────────────────────────────
        print(f"⏳  [AI LOG] Calling Gemini for Workout Plan... (Wait 3-5 seconds)")
        workout_prompt = f"""You are MuscleForge AI — an expert gym coach.
Be CONCISE. Respond in English only.

USER: Weight: {data.weight}kg | Age: {data.age} | Gender: {data.gender} | Goal: {goal_display}
Training: {training_days} days/week | Body Fat: {data.body_fat_pct or '?'}% | SMM: {data.smm or '?'}kg
Conditions: {data.disease or 'none'}

Generate a {training_days}-day workout program. 5 exercises per day.
Format: Day N — <Focus> then - <Exercise> — <sets> x <reps>
End with COACH NOTES (3 bullet points about recovery/nutrition/form)."""

        workout_plan_text = _query_gemini(workout_prompt)
        print(f"✅  [AI LOG] Workout Plan Generated successfully.")

        plan_text = f"{meal_plan_text}\n\n{workout_plan_text}"
        
        print(f"🚀  [AI LOG] Full AI Plan sent back to frontend!")
        print(f"==============================================\n")

        return {
            # ─── Core fields (used by backend mapping) ───────────────
            "predicted_goal": goal,
            "goal": goal,
            "biological_age": bio_age,
            "total_calories": calories,
            "calories": calories,
            "protein_g": macros["protein"],
            "protein": macros["protein"],
            "carbs_g": macros["carbs"],
            "carbs": macros["carbs"],
            "fats_g": macros["fat"],
            "fat": macros["fat"],
            # ─── Separate plan texts (required by frontend) ──────────
            "workout_plan_text": workout_plan_text,
            "meal_plan_text": meal_plan_text,
            "coach_notes": f"Goal: {goal_display} | BMI: {bmi} | Bio Age: {bio_age}",
            "plan_text": plan_text,
            "bmi": bmi
        }
    except HTTPException:
        raise  # Re-raise Gemini errors with proper status codes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── 2. AI Gym Coach Chat (Gemini-powered) ────────────────────────
@app.post("/chat")
def chat(data: ChatRequest):
    """
    AI Gym Coach Chatbot powered by Gemini
    Uses google.genai chats for conversation history management
    """
    try:
        # Convert history to Gemini format
        gemini_history = []
        if data.history:
            for msg in data.history[-6:]:
                if isinstance(msg, dict):
                    role = msg.get("role", "user")
                    content = msg.get("content", msg.get("message", ""))
                    gemini_role = "model" if role in ("assistant", "bot", "coach", "model") else "user"
                    gemini_history.append(
                        types.Content(role=gemini_role, parts=[types.Part(text=content)])
                    )

            # Ensure history starts with user and alternates
            if gemini_history and gemini_history[0].role != "user":
                gemini_history = gemini_history[1:]
            
            # Merge consecutive same-role messages
            cleaned = []
            for msg in gemini_history:
                if cleaned and cleaned[-1].role == msg.role:
                    existing_text = cleaned[-1].parts[0].text
                    new_text = msg.parts[0].text
                    cleaned[-1] = types.Content(
                        role=msg.role,
                        parts=[types.Part(text=existing_text + "\n" + new_text)],
                    )
                else:
                    cleaned.append(msg)
            gemini_history = cleaned
            
            # Remove trailing user message (will be sent as new message)
            if gemini_history and gemini_history[-1].role == "user":
                gemini_history = gemini_history[:-1]

        chat_session = _client.chats.create(
            model=MODEL_NAME,
            history=gemini_history,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.4,
                top_p=0.9,
                max_output_tokens=1024,
            ),
        )

        prompt = f"""You are MuscleForge AI — an expert gym coach.
RULES: Only answer fitness/gym/nutrition questions. Be concise (100-200 words).
Use metric units. Speak like a coach, not a textbook. Be motivational.

User: {data.message}
Coach:"""

        response = chat_session.send_message(prompt)

        return {"reply": response.text.strip()}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Chat ERROR] {type(e).__name__}: {e}")
        # Fallback to single-turn
        try:
            fallback = _query_gemini(
                f"You are a gym coach. Answer briefly: {data.message}"
            )
            return {"reply": fallback}
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Chat service temporarily unavailable. Please try again."
            )


# ─── 3. Biological Age ────────────────────────────────────────────
@app.post("/biological-age")
def biological_age(data: BiologicalAgeRequest):
    """حساب العمر البيولوجي"""
    try:
        bmi = calculate_bmi(data.weight, data.height)
        bio_age = calculate_biological_age(
            age=data.age,
            gender=data.gender,
            body_fat_pct=data.body_fat_pct or 20,
            smm=data.smm or 0,
            visceral_fat=data.visceral_fat or 0,
            bmi=bmi
        )
        return {"biological_age": bio_age}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── 4. Progress Analysis ─────────────────────────────────────────
@app.post("/progress-analysis")
def progress_analysis(data: ProgressAnalysisRequest):
    """مقارنة scan جديد بـ scan قديم"""
    try:
        curr = data.current_scan
        prev = data.previous_scan

        def diff(key):
            c = curr.get(key, 0) or 0
            p = prev.get(key, 0) or 0
            return round(c - p, 2)

        return {
            "weight_change":  diff("weight"),
            "fat_change":     diff("body_fat_pct"),
            "muscle_change":  diff("muscle_mass"),
            "bmi_change":     diff("bmi"),
            "summary": "Progress tracked successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── 5. Generate PDF Report ───────────────────────────────────────
@app.post("/generate-pdf")
def generate_pdf_endpoint(data: GeneratePdfRequest):
    """توليد PDF Report"""
    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=40, leftMargin=40,
                                topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()
        styleN = styles["Normal"]
        styleH = styles["Heading1"]
        styleH2 = styles["Heading2"]
        
        flowables = []
        flowables.append(Paragraph(f"SmartGym AI - Fitness Report", styleH))
        flowables.append(Spacer(1, 12))
        
        flowables.append(Paragraph("User Metrics", styleH2))
        metrics_text = f"Weight: {data.weight}kg | Height: {data.height}cm | Age: {data.age}<br/>"
        metrics_text += f"Gender: {data.gender} | Goal: {data.goal.replace('_', ' ').title()}<br/>"
        metrics_text += f"Bio Age: {data.biological_age or data.age} | Body Fat %: {data.body_fat_pct or 'N/A'}<br/>"
        flowables.append(Paragraph(metrics_text, styleN))
        flowables.append(Spacer(1, 12))
        
        flowables.append(Paragraph("Daily Target Macros", styleH2))
        macros_text = f"Calories: {data.calories} kcal<br/>Protein: {data.protein}g | Carbs: {data.carbs}g | Fat: {data.fat}g"
        flowables.append(Paragraph(macros_text, styleN))
        flowables.append(Spacer(1, 20))
        
        flowables.append(Paragraph("Your AI Plan", styleH2))
        
        # Replace newlines with <br/> for ReportLab
        formatted_plan = data.plan_text.replace('\n', '<br/>')
        flowables.append(Paragraph(formatted_plan, styleN))
        
        doc.build(flowables)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=report.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════
# 🚀 Run
# ══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
