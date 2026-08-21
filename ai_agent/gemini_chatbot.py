"""
gemini_chatbot.py
-----------------
AI Gym Coach chatbot powered by Google Gemini.
Uses the modern `google.genai` SDK with `client.chats.create()` for
native conversation management.
Replaces the old gym_chatbot.py that used Ollama/query_llama.
"""

from google.genai import types
from gemini_client import get_client, MODEL_NAME, SYSTEM_INSTRUCTION, query_gemini
from gym_chat_guard import guard_question


def _convert_history_to_gemini(history: list) -> list:
    """
    Convert chat history from Node.js format to Gemini SDK format.

    Node.js sends:  [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    Gemini expects:  [Content(role="user", parts=[Part(text="...")]), ...]

    Only keeps the last 6 messages to avoid token overflow.
    """
    if not history:
        return []

    gemini_history = []
    for msg in history[-6:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        # Map roles: Node.js uses "assistant", Gemini uses "model"
        if role in ("assistant", "bot", "coach", "model"):
            gemini_role = "model"
        else:
            gemini_role = "user"

        gemini_history.append(
            types.Content(
                role=gemini_role,
                parts=[types.Part(text=content)],
            )
        )

    # Gemini requires history to start with a "user" message
    if gemini_history and gemini_history[0].role != "user":
        gemini_history = gemini_history[1:]

    # Ensure alternating roles (merge consecutive same-role messages)
    cleaned = []
    for msg in gemini_history:
        if cleaned and cleaned[-1].role == msg.role:
            # Merge consecutive same-role messages
            existing_text = cleaned[-1].parts[0].text
            new_text = msg.parts[0].text
            cleaned[-1] = types.Content(
                role=msg.role,
                parts=[types.Part(text=existing_text + "\n" + new_text)],
            )
        else:
            cleaned.append(msg)

    # Gemini history must end with a "model" message (not "user")
    if cleaned and cleaned[-1].role == "user":
        cleaned = cleaned[:-1]

    return cleaned


def _build_user_context(context: dict) -> str:
    """
    Build a rich context block from the user's InBody data, meal plan, and workout plan.
    context keys (all optional):
        inbody   - dict with weight, height, age, gender, body_fat_pct, etc.
        plan_text - full LLM plan output (meal + workout + coach notes)
        goal     - predicted goal string
    """
    if not context:
        return ""

    lines = ["--- USER PROFILE (use this to personalise EVERY answer) ---"]

    inbody = context.get("inbody")
    if inbody:
        lines.append(
            f"Weight: {inbody.get('weight','?')} kg | Height: {inbody.get('height','?')} cm | "
            f"Age: {inbody.get('age','?')} | Gender: {inbody.get('gender','?')} | "
            f"Bio Age: {inbody.get('biological_age','?')} yrs"
        )
        lines.append(
            f"Body Fat: {inbody.get('body_fat_pct','?')}% ({inbody.get('body_fat_mass','?')} kg) | "
            f"Muscle Mass: {inbody.get('muscle_mass','?')} kg | SMM: {inbody.get('smm','?')} kg | "
            f"BMR: {inbody.get('bmr','?')} kcal | Visceral Fat: {inbody.get('visceral_fat','?')}"
        )
        lines.append(
            f"Body Water: {inbody.get('total_body_water','?')} L | "
            f"Waist: {inbody.get('waist_cm','?')} cm"
        )
        if inbody.get("disease") and inbody.get("disease") != "none":
            lines.append(f"Medical Conditions: {inbody['disease']} — keep this in mind for all advice.")
        if inbody.get("allergies") and inbody.get("allergies") != "none":
            lines.append(f"Allergies/Restrictions: {inbody['allergies']}")

    goal = context.get("goal")
    if goal:
        goal_readable = goal.replace("_", " ").title()
        lines.append(f"Current AI-predicted goal: {goal_readable}")

    plan_text = context.get("plan_text")
    if plan_text:
        import re
        # Try to extract WORKOUT PLAN
        workout_match = re.search(
            r"WORKOUT PLAN\s*\n(.*?)(?=\nCOACH NOTES|\nDAILY TARGET|\nMEAL PLAN|$)",
            plan_text, re.DOTALL | re.IGNORECASE
        )
        coach_match = re.search(
            r"COACH NOTES\s*\n(.*?)$",
            plan_text, re.DOTALL | re.IGNORECASE
        )
        if workout_match:
            workout_text = workout_match.group(1).strip()
            if workout_text:
                lines.append("\n--- CURRENT WORKOUT PLAN ---")
                lines.append(workout_text[:1200])  # cap to avoid token overflow

        # For meal plan: extract just the structure
        daily_target_match = re.search(
            r"DAILY TARGET\s*\n(.+?)(?=\n)", plan_text, re.IGNORECASE
        )
        if daily_target_match:
            lines.append(f"\nDaily Nutrition Target: {daily_target_match.group(1).strip()}")

        if coach_match:
            coach_text = coach_match.group(1).strip()
            if coach_text:
                lines.append("\n--- COACH NOTES ---")
                lines.append(coach_text[:600])

    lines.append("--- END USER PROFILE ---\n")
    return "\n".join(lines)


def gym_chatbot(question: str, history: list = None, context: dict = None) -> str:
    """
    AI Gym Coach chatbot using Gemini with native chat history.

    Args:
        question: User's question
        history: Previous chat messages list [{role, content}, ...]
        context: Dict with keys: inbody (dict), plan_text (str), goal (str)
    """
    # Safety guard — block harmful content
    allowed, msg = guard_question(question)
    if not allowed:
        return msg

    # Build user context from InBody data
    user_context = _build_user_context(context) if context else ""

    # Build the user message with context
    full_message = f"""You are MuscleForge AI — an expert gym coach, personal trainer, and sports nutritionist.

YOUR PERSONALITY:
- Motivational, direct, practical — give real actionable advice
- Use bullet points and short paragraphs
- Speak like a coach, not a textbook

YOUR RULES:
1. ONLY answer questions related to: fitness, gym, training, workouts, nutrition, diet, meal plans, recovery, supplements, body composition, weight loss, muscle gain, sports injuries, sleep for athletes.
2. If someone greets you, respond warmly and briefly ask how you can help.
3. If the question is completely unrelated to fitness, politely decline.
4. Use metric units (kg, cm, g, kcal) always.
5. If the question has a typo, understand the intent and answer helpfully.
6. For injury questions: give initial advice AND recommend a doctor/physio for serious cases.
7. BE CONCISE: aim for 100-200 words max per response. No long intros or conclusions.
8. Respond in English only.
9. IMPORTANT: If you have the user's profile above, ALWAYS reference their actual data (weight, body fat %, current plan) when relevant — make advice personal, not generic.

{user_context}
User: {question}

Coach (be brief and direct):"""

    try:
        # Convert history to Gemini format and use chat API
        gemini_history = _convert_history_to_gemini(history) if history else []

        chat = get_client().chats.create(
            model=MODEL_NAME,
            history=gemini_history,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.4,
                top_p=0.9,
                max_output_tokens=1024,
            ),
        )
        response = chat.send_message(full_message)
        return response.text.strip()

    except Exception as e:
        # Fallback: if chat mode fails, use simple query
        print(f"[Gemini Chat ERROR] {type(e).__name__}: {e}")
        print("[Gemini Chat] Falling back to single-turn query...")
        return query_gemini(full_message)


# -----------------------------------
# TEST MODE
# -----------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("  Testing Gemini Chatbot — MuscleForge AI")
    print(f"  Model: {MODEL_NAME}")
    print("=" * 60)

    # Test 1: Simple greeting
    print("\n[Test 1] Greeting...")
    reply = gym_chatbot("Hey coach!")
    print(f"  -> {reply[:200]}")

    # Test 2: Fitness question
    print("\n[Test 2] Fitness question...")
    reply = gym_chatbot("How many calories should I eat to lose fat?")
    print(f"  → {reply[:300]}")

    # Test 3: Off-topic question
    print("\n[Test 3] Off-topic question...")
    reply = gym_chatbot("What's the capital of France?")
    print(f"  -> {reply[:200]}")

    # Test 4: With history
    print("\n[Test 4] With conversation history...")
    test_history = [
        {"role": "user", "content": "I weigh 90kg"},
        {"role": "assistant", "content": "Got it! At 90kg, let's work on your goals. What are you aiming for?"},
    ]
    reply = gym_chatbot("I want to lose fat", history=test_history)
    print(f"  → {reply[:300]}")

    # Test 5: Blocked content
    print("\n[Test 5] Blocked content...")
    reply = gym_chatbot("How to make a bomb")
    print(f"  → {reply[:200]}")

    print("\n✅ All chatbot tests completed!")
