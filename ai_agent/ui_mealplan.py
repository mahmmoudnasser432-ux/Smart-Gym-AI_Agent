import re
import requests
import streamlit as st
import pandas as pd
from gym_chatbot import gym_chatbot
from progress_tracker import save_scan, load_history, get_last_scan
from biological_age import calculate_biological_age
from pdf_exporter import generate_pdf_report
from saved_plans import save_plan, load_plans, delete_plan
from db_reader import get_latest_inbody, get_username

st.set_page_config(page_title="Smart AI Gym Coach", layout="wide", page_icon="🏋️")

# ===============================
# PLAN CARD RENDERER
# ===============================

MEAL_ICONS = {
    "BREAKFAST": "🍳",
    "SNACK 1": "🍎",
    "LUNCH": "🥗",
    "SNACK 2": "🍌",
    "DINNER": "🍽️",
}

OPTION_COLORS = {
    "A": ("#4f8ef7", "#1a2340"),   # blue
    "B": ("#a855f7", "#1e1a30"),   # purple
    "C": ("#22c55e", "#142010"),   # green
}


def _parse_option_line(line: str) -> dict:
    """Parse a [A]/[B]/[C] line into name, ingredients, macros."""
    # Format: [A] Name | ingredients | kcal kcal | P:Xg C:Xg F:Xg
    parts = [p.strip() for p in line.split("|")]
    name = parts[0] if parts else line
    ingredients = parts[1] if len(parts) > 1 else ""
    kcal_str = parts[2] if len(parts) > 2 else ""
    macros = parts[3] if len(parts) > 3 else ""
    return {"name": name, "ingredients": ingredients, "kcal": kcal_str, "macros": macros}


def _render_plan_cards(plan_text: str):
    """Parse and render a structured meal plan with beautiful cards."""

    # ── Section split ─────────────────────────────────────────────────────────
    lines = plan_text.strip().split("\n")

    sections = {}          # {section_name: [lines]}
    current_section = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        # Detect === MEAL === headers
        meal_match = re.match(r"===\s*(.+?)\s*===", line)
        if meal_match:
            current_section = meal_match.group(1).upper().strip()
            sections.setdefault(current_section, [])
            continue

        # Detect WORKOUT PLAN / COACH NOTES / DAILY TARGET sections
        upper = line.upper().strip(":")
        if upper in ("WORKOUT PLAN", "COACH NOTES", "DAILY TARGET", "MEAL PLAN"):
            current_section = upper
            sections.setdefault(current_section, [])
            continue

        if current_section is not None:
            sections[current_section].append(line)

    # ── DAILY TARGET ──────────────────────────────────────────────────────────
    if "DAILY TARGET" in sections:
        target_text = " ".join(sections["DAILY TARGET"])
        st.markdown(
            f"""<div style="background:linear-gradient(135deg,#1a2340,#1e1a30);border-radius:12px;
                padding:14px 22px;border:1px solid #4f8ef720;margin-bottom:18px;">
                <span style="color:#aab2cc;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Daily Target</span>
                <div style="color:#ffffff;font-size:16px;font-weight:600;margin-top:4px;">{target_text}</div>
            </div>""",
            unsafe_allow_html=True,
        )

    # ── MEAL PLAN ─────────────────────────────────────────────────────────────
    st.markdown("### 🥘 Meal Plan")
    meal_order = ["BREAKFAST", "SNACK 1", "LUNCH", "SNACK 2", "DINNER"]

    for meal_name in meal_order:
        if meal_name not in sections:
            continue
        meal_lines = sections[meal_name]
        icon = MEAL_ICONS.get(meal_name, "🍴")

        # Header
        st.markdown(
            f"""<div style="background:#1e2130;border-radius:12px 12px 0 0;padding:10px 18px;
                margin-top:14px;border-left:4px solid #4f8ef7;">
                <span style="color:#ffffff;font-size:15px;font-weight:700;">{icon} {meal_name.title()}</span>
            </div>""",
            unsafe_allow_html=True,
        )

        # Options
        options = {}
        for ml in meal_lines:
            opt_match = re.match(r"\[([ABC])\]\s*(.+)", ml)
            if opt_match:
                letter = opt_match.group(1)
                rest = opt_match.group(2)
                options[letter] = _parse_option_line(rest)

        if options:
            tabs = st.tabs([f"Option {k}" for k in sorted(options.keys())])
            for tab, (letter, opt) in zip(tabs, sorted(options.items())):
                accent, bg = OPTION_COLORS.get(letter, ("#ffffff", "#1e2130"))
                with tab:
                    st.markdown(
                        f"""<div style="background:{bg};border-radius:0 0 12px 12px;padding:14px 18px;border:1px solid {accent}30;">
                            <div style="color:{accent};font-size:15px;font-weight:700;margin-bottom:6px;">{opt['name']}</div>
                            <div style="color:#c8d0e0;font-size:13px;margin-bottom:8px;">🧂 {opt['ingredients']}</div>
                            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                                <span style="background:{accent}22;color:{accent};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">🔥 {opt['kcal']}</span>
                                <span style="background:#ffffff11;color:#e2e8f0;padding:3px 10px;border-radius:20px;font-size:12px;">{opt['macros']}</span>
                            </div>
                        </div>""",
                        unsafe_allow_html=True,
                    )
        else:
            # Fallback: raw text if parsing failed
            for ml in meal_lines:
                st.markdown(f"- {ml}")

    # ── WORKOUT PLAN ──────────────────────────────────────────────────────────
    if "WORKOUT PLAN" in sections:
        st.markdown("### 💪 Workout Plan")
        workout_lines = sections["WORKOUT PLAN"]
        
        # Render exactly as it appears in the PDF: Text-based, no expanders
        for wl in workout_lines:
            wl = wl.strip()
            if not wl: continue
            
            # If it's a day header, make it distinct but not an expander
            if re.match(r"^Day\s*\d+", wl, re.IGNORECASE):
                st.markdown(f"#### 🏋️ {wl}")
            else:
                # Normal exercise line
                ex = wl.lstrip("-•* ")
                st.markdown(
                    f"""<div style="background:#1e2130;border-radius:8px;padding:8px 14px;margin-bottom:6px;
                                   border-left:3px solid #4f8ef7;">
                        <span style="color:#e2e8f0;font-size:13px;">{ex}</span>
                    </div>""",
                    unsafe_allow_html=True,
                )

    # ── COACH NOTES ───────────────────────────────────────────────────────────
    if "COACH NOTES" in sections:
        st.markdown("### 📋 Coach Notes")
        for note in sections["COACH NOTES"]:
            note = note.lstrip("-•* ")
            if note:
                st.markdown(
                    f"""<div style="background:#1e1a30;border-radius:8px;padding:10px 16px;margin-bottom:8px;
                                   border-left:3px solid #a855f7;">
                        <span style="color:#e2e8f0;font-size:13px;">{note}</span>
                    </div>""",
                    unsafe_allow_html=True,
                )



# ===============================
# SESSION STATE INIT
# ===============================

if "page" not in st.session_state:
    st.session_state.page = "meal"

if "messages" not in st.session_state:
    st.session_state.messages = []

if "last_plan_result" not in st.session_state:
    st.session_state.last_plan_result = None

if "last_plan_data" not in st.session_state:
    st.session_state.last_plan_data = None

# Cache PDF bytes so re-download doesn't regenerate (avoids disappearing button)
if "last_pdf_bytes" not in st.session_state:
    st.session_state.last_pdf_bytes = None

# Holds the InBody data fetched from the backend API
if "db_inbody" not in st.session_state:
    st.session_state.db_inbody = None

if "db_user_id" not in st.session_state:
    st.session_state.db_user_id = None

if "db_token" not in st.session_state:
    st.session_state.db_token = ""

# ===============================
# NAVIGATION
# ===============================

def go_chat():
    st.session_state.page = "chat"

def go_meal():
    st.session_state.page = "meal"

def go_progress():
    st.session_state.page = "progress"


# ================================
# STYLES
# ================================

st.markdown("""
<style>
    .metric-box {
        background: #1e2130;
        border-radius: 12px;
        padding: 14px 18px;
        margin: 6px 0;
        border-left: 4px solid #4f8ef7;
    }
    .metric-label { color: #aab2cc; font-size: 12px; }
    .metric-value { color: #ffffff; font-size: 22px; font-weight: bold; }
    .delta-pos { color: #22c55e; font-size: 13px; }
    .delta-neg { color: #ef4444; font-size: 13px; }
    .section-header {
        background: linear-gradient(90deg, #4f8ef7 0%, #a855f7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 26px; font-weight: 800; margin-bottom: 8px;
    }
</style>
""", unsafe_allow_html=True)


# ================================
# SIDEBAR NAVIGATION
# ================================

with st.sidebar:
    st.markdown("## 🏋️ MuscleForge AI")
    st.markdown("---")
    if st.button("📋  Meal Plan Generator", use_container_width=True):
        st.session_state.page = "meal"
    if st.button("📈  Progress History", use_container_width=True):
        st.session_state.page = "progress"
    if st.button("📚  Saved Plans", use_container_width=True):
        st.session_state.page = "saved"
    if st.button("💬  AI Coach Chat", use_container_width=True):
        st.session_state.page = "chat"
    st.markdown("---")

    # Show last scan badge
    last = get_last_scan()
    if last:
        st.markdown(f"**Last scan:** {last.get('timestamp', 'N/A')}")
        st.markdown(f"⚖️ `{last.get('weight', '?')} kg`  🔥 `{last.get('body_fat_pct', '?')}% fat`")
    else:
        st.info("No previous scan saved yet.")


# ===============================
# MEAL PLAN PAGE
# ===============================

def meal_plan_page():

    st.markdown('<p class="section-header">Smart AI Meal Plan Generator</p>', unsafe_allow_html=True)
    st.write("Enter your User ID to load your latest InBody scan from the database, then generate your personalized plan.")
    st.divider()

    # ════════════════════════════════════════════════════════════
    # STEP 1 — Authenticate & Load InBody from Backend
    # ════════════════════════════════════════════════════════════
    st.subheader("🔗 Step 1 — Load Your InBody Data")

    col_tok, col_btn = st.columns([3, 1])
    with col_tok:
        user_id_input = st.number_input(
            "User ID", 
            min_value=1, 
            step=1,
            value=int(st.session_state.db_user_id) if st.session_state.db_user_id else 1,
            help="Enter your gym user ID to view the latest scan."
        )

    token_input = st.text_input(
        "🔑 Bearer Token (JWT)",
        value=st.session_state.db_token,
        type="password",
        placeholder="Paste your JWT token here...",
        help="Your authentication token from the SmartGym app."
    )

    with col_btn:
        st.markdown("<br>", unsafe_allow_html=True)
        load_clicked = st.button("🔍 Load My InBody Data", use_container_width=True, type="primary")

    if load_clicked:
        st.session_state.db_token = token_input.strip()
        with st.spinner("Fetching your latest InBody scan..."):
            scan = get_latest_inbody(int(user_id_input), token=st.session_state.db_token)
        if scan is None:
            st.error("❌ No InBody scan found for this account. Please ask staff to upload your scan first.")
            st.session_state.db_inbody = None
        elif "_error" in scan:
            st.error(f"❌ {scan['_error']}")
            st.session_state.db_inbody = None
        else:
            st.session_state.db_inbody = scan
            st.session_state.db_user_id = int(user_id_input)
            st.success("✅ InBody data loaded successfully!")

    # ════════════════════════════════════════════════════════════
    # STEP 2 — Show fetched data
    # ════════════════════════════════════════════════════════════
    scan = st.session_state.db_inbody

    if scan is None:
        st.info("👆 Enter your User ID above and click **🔍 Load My InBody Data** to continue.")
        return

    # ── InBody summary cards (read-only) ─────────────────────────
    st.divider()
    st.subheader("📊 Your Latest InBody Scan")
    st.caption(f"📅 Scan date: {scan.get('scan_timestamp', 'N/A')}")

    def _info_card(col, label, value, unit=""):
        col.markdown(
            f"""<div style="background:#1e2130;border-radius:10px;padding:12px 14px;text-align:center;">
                <div style="color:#aab2cc;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">{label}</div>
                <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:4px;">{value} <span style="color:#4f8ef7;font-size:13px;">{unit}</span></div>
            </div>""",
            unsafe_allow_html=True,
        )

    # Row 1 — Main body metrics
    r1 = st.columns(4)
    _info_card(r1[0], "Weight",      f"{float(scan.get('weight_kg', 0)):.1f}",         "kg")
    _info_card(r1[1], "Height",      f"{float(scan.get('height_cm', 0)):.1f}",         "cm")
    _info_card(r1[2], "BMR",         f"{float(scan.get('bmr', 0)):.0f}",               "kcal")
    _info_card(r1[3], "Waist",       f"{float(scan.get('waist_cm', 0)):.1f}",          "cm")

    # Row 2 — Body composition
    r2 = st.columns(4)
    _info_card(r2[0], "Body Fat %",  f"{float(scan.get('body_fat_pct', 0)):.1f}",      "%")
    _info_card(r2[1], "Fat Mass",    f"{float(scan.get('body_fat_mass', 0)):.1f}",     "kg")
    _info_card(r2[2], "Muscle Mass", f"{float(scan.get('muscle_mass', 0)):.1f}",      "kg")
    _info_card(r2[3], "SMM",         f"{float(scan.get('smm', 0)):.1f}",               "kg")

    # Row 3 — Other metrics
    r3 = st.columns(4)
    _info_card(r3[0], "Visceral Fat",    str(scan.get('visceral_fat', '—')),                 "lvl")
    _info_card(r3[1], "Body Water",      f"{float(scan.get('total_body_water', 0)):.1f}",    "L")
    _info_card(r3[2], "Biological Age",  str(scan.get('biological_age', '—')),               "yrs")
    _info_card(r3[3], "AI Goal",         str(scan.get('predicted_goal', '—')).replace('_', ' ').title(), "")

    # ── Extract values from API response ─────────────────────────
    weight           = float(scan.get('weight_kg', 80))
    height           = float(scan.get('height_cm', 175))
    body_fat_pct     = float(scan.get('body_fat_pct', 18))
    body_fat_mass    = float(scan.get('body_fat_mass', round(weight * body_fat_pct / 100, 2)))
    muscle_mass      = float(scan.get('muscle_mass', 60))
    smm              = float(scan.get('smm', 32))
    protein_mass     = float(scan.get('protein_mass', 10))
    total_body_water = float(scan.get('total_body_water', 40))
    visceral_fat     = float(scan.get('visceral_fat', 8))
    bmr              = float(scan.get('bmr', 1700))
    waist_cm         = float(scan.get('waist_cm', 90))
    # biological_age from API (use our calculator as fallback later)
    api_bio_age      = scan.get('biological_age')

    # ── Fields not in API — user provides these ───────────────────
    st.divider()
    st.subheader("📋 Additional Info (not in scan)")
    st.caption("These fields are not yet in the scan response. Fill them in or keep the defaults.")

    ci1, ci2, ci3, ci4 = st.columns(4)
    with ci1:
        age = st.number_input("Age (yrs)", min_value=10, max_value=100, value=25, step=1)
    with ci2:
        gender = st.selectbox("Gender", ["male", "female"])
    with ci3:
        activity_level = st.selectbox(
            "Activity Level",
            ["sedentary", "light", "moderate", "active", "athlete"],
            index=2
        )
    with ci4:
        training_frequency = st.number_input(
            "Training days/week", min_value=1, max_value=7, value=3, step=1
        )
    # budget is chosen by the user in Step 3 below


    # ════════════════════════════════════════════════════════════
    # STEP 3 — User fills in Allergies, Diseases & Budget
    # ════════════════════════════════════════════════════════════
    st.divider()
    st.subheader("⚕️ Step 2 — Health, Dietary Info & Budget")
    st.info("🤖 **Your goal will be predicted automatically** by the AI model based on your InBody data.")

    col_a, col_b, col_c = st.columns(3)
    with col_a:
        allergies = st.text_input(
            "🥜 Allergies / Dietary restrictions",
            value="none",
            placeholder="e.g. lactose, gluten, nuts — or type 'none'"
        )
    with col_b:
        disease = st.text_input(
            "🩺 Diseases / Conditions",
            value="none",
            placeholder="e.g. diabetes, hypertension — or type 'none'"
        )
    with col_c:
        budget = st.selectbox(
            "💰 Budget Level",
            ["low", "moderate", "high"],
            index=["low", "moderate", "high"].index(
                scan.get("budget", "moderate") if scan.get("budget") in ["low", "moderate", "high"] else "moderate"
            ),
            help="low = affordable everyday foods | moderate = balanced variety | high = premium ingredients"
        )

    st.divider()

    # ── Biological age: prefer API value, fall back to local calculator ──
    if api_bio_age is not None:
        bio_age = int(api_bio_age)
    else:
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

    # ── Adaptive plan info ────────────────────────────────────────
    previous_scan = get_last_scan()
    if previous_scan:
        st.success(f"✅ **Adaptive Plan enabled** — previous scan from **{previous_scan.get('timestamp', 'N/A')}** found.")
    else:
        st.info("💡 **No previous scan saved.** Save your current scan after generating to enable Adaptive Plans.")

    # ════════════════════════════════════════════════════════════
    # STEP 4 — Buttons
    # ════════════════════════════════════════════════════════════
    col_gen, col_save = st.columns([3, 1])

    with col_gen:
        generate_clicked = st.button(
            "🚀 Generate Smart Meal & Workout Plan",
            type="primary", use_container_width=True
        )
    with col_save:
        save_clicked = st.button("💾 Save Scan to History", use_container_width=True)

    if save_clicked:
        scan_data = {
            "weight": weight, "height": height, "age": age, "gender": gender,
            "body_fat_mass": body_fat_mass, "body_fat_pct": body_fat_pct,
            "protein_mass": protein_mass, "muscle_mass": muscle_mass,
            "smm": smm, "visceral_fat": visceral_fat, "bmr": bmr,
            "total_body_water": total_body_water, "waist_cm": waist_cm,
            "activity_level": activity_level,
        }
        save_scan(scan_data)
        st.success("✅ Scan saved! Go to **Progress History** to view your timeline.")
        st.rerun()

    if generate_clicked:
        _token = st.session_state.get("db_token", "")
        if not _token:
            st.error("❌ Please enter your Bearer Token first in Step 1 before generating a plan.")
        else:
            with st.spinner("🤖 AI is generating your personalized plan... This may take a moment."):
                try:
                    from db_reader import BACKEND_HOST as _BACKEND_HOST

                    url = f"{_BACKEND_HOST}/api/ai/generate-plan"
                    _headers = {
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {_token}"
                    }
                    inbody_data = st.session_state.get("db_inbody", {})
                    payload = {
                        "user_id":           int(st.session_state.get("db_user_id", 0)),
                        "inbody_data":       inbody_data,
                        "age":               age,
                        "gender":            gender,
                        "activity_level":    activity_level,
                        "training_frequency":training_frequency,
                        "allergies":         allergies,
                        "disease":           disease,
                        "previous_scan":     previous_scan,
                        "budget":            budget
                    }

                    response = requests.post(url, json=payload, headers=_headers, timeout=120)

                    if response.status_code not in (200, 201):
                        st.error(f"❌ Server error ({response.status_code}): {response.text[:300]}")
                    else:
                        data       = response.json()
                        # Support both flat and nested response shapes
                        result     = data.get("plan_text") or data.get("data", {}).get("plan_text", "")
                        agent_data = data.get("agent_data") or data.get("data", {}).get("agent_data", {})

                        detected_goal = agent_data.get("goal", "balanced")

                        st.session_state.last_plan_result = result
                        st.session_state.last_plan_data = {
                            "weight": weight, "height": height, "age": age,
                            "biological_age": agent_data.get("biological_age", bio_age),
                            "gender": gender,
                            "body_fat_pct": body_fat_pct, "body_fat_mass": body_fat_mass,
                            "muscle_mass": muscle_mass, "smm": smm,
                            "visceral_fat": visceral_fat, "bmr": bmr,
                            "total_body_water": total_body_water,
                            "goal":    detected_goal,
                            "calories":agent_data.get("calories", 0),
                            "protein": agent_data.get("protein", 0),
                            "carbs":   agent_data.get("carbs", 0),
                            "fat":     agent_data.get("fat", 0),
                            "disease":  disease,
                            "allergies": allergies,
                            "waist_cm": waist_cm,
                            "_previous_scan": previous_scan,
                            "_agent_data":    agent_data,
                            "_bio_age_chron": age,
                        }
                        st.session_state.last_pdf_bytes = None
                        st.success("✅ Plan generated and saved to your profile on the server!")

                except ValueError as e:
                    st.error(f"⚠️ Input error: {e}")
                except Exception as e:
                    st.error(f"❌ Error generating plan: {e}")

    # ── Render plan results (persists across reruns via session state) ─────────
    if st.session_state.last_plan_result and st.session_state.last_plan_data:
        d = st.session_state.last_plan_data
        result = st.session_state.last_plan_result
        detected_goal = d.get("goal", "balanced")
        plan_bio_age = d.get("biological_age", bio_age)
        previous_scan = d.get("_previous_scan")
        agent_data = d.get("_agent_data", d)
        chron_age = d.get("_bio_age_chron", age)

        goal_display = {
            "aggressive_fat_loss":  ("🔥 AGGRESSIVE FAT LOSS", "#dc2626"), # red-600
            "fat_loss":             ("🏃 FAT LOSS",            "#ef4444"), # red-500
            "body_recomposition":   ("⚖️ BODY RECOMPOSITION", "#8b5cf6"), # violet-500
            "athletic_performance": ("⚡ ATHLETIC PERFORMANCE","#3b82f6"), # blue-500
            "lean_muscle_gain":     ("💪 LEAN MUSCLE GAIN",    "#10b981"), # emerald-500
            "muscle_gain":          ("🏋️ BULKING (MUSCLE)",   "#22c55e"), # green-500
            "maintenance":          ("🎯 MAINTENANCE",         "#6366f1"), # indigo-500
            "balanced":             ("⚖️ BALANCED",           "#3b82f6"), # fallback
        }.get(detected_goal, ("🎯 CUSTOM GOAL", "#6366f1"))

        st.divider()
        st.markdown(
            f"""
            <div style="background:{goal_display[1]};border-radius:14px;
                        padding:20px;text-align:center;margin-bottom:18px;">
                <span style="color:white;font-size:26px;font-weight:800;
                             letter-spacing:2px;">{goal_display[0]}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # ── InBody Comparison (if previous scan exists) ───────────────────────
        if previous_scan:
            st.subheader("🔄 InBody Progress Since Last Scan")
            prev_ts = previous_scan.get('timestamp', 'previous scan')
            st.caption(f"Comparing current scan vs {prev_ts}")

            def _diff_card(col, label, key, unit, lower_is_better=False):
                cur = float(d.get(key, 0) or 0)
                prv = float(previous_scan.get(key, 0) or 0)
                diff = cur - prv
                if abs(diff) < 0.01:
                    arrow, color = "→", "#94a3b8"
                    verdict = "No change"
                elif (diff < 0 and lower_is_better) or (diff > 0 and not lower_is_better):
                    arrow, color = "⬆️", "#22c55e"
                    verdict = "Improved ✅"
                else:
                    arrow, color = "⬇️", "#ef4444"
                    verdict = "Worsened ⚠️"
                sign = "+" if diff > 0 else ""
                col.markdown(
                    f"""<div style="background:#1e2130;border-radius:10px;padding:12px 14px;text-align:center;">
                        <div style="color:#aab2cc;font-size:11px;">{label}</div>
                        <div style="color:#ffffff;font-size:20px;font-weight:700;">{cur:.1f} {unit}</div>
                        <div style="color:{color};font-size:13px;">{arrow} {sign}{diff:.1f} {unit}</div>
                        <div style="color:{color};font-size:11px;">{verdict}</div>
                    </div>""",
                    unsafe_allow_html=True,
                )

            r1 = st.columns(4)
            _diff_card(r1[0], "Weight",     "weight",        "kg",   lower_is_better=True)
            _diff_card(r1[1], "Body Fat %", "body_fat_pct",  "%",    lower_is_better=True)
            _diff_card(r1[2], "Muscle Mass","muscle_mass",   "kg",   lower_is_better=False)
            _diff_card(r1[3], "BMR",        "bmr",           "kcal", lower_is_better=False)

            r2 = st.columns(4)
            _diff_card(r2[0], "Fat Mass",     "body_fat_mass",   "kg",  lower_is_better=True)
            _diff_card(r2[1], "Visceral Fat", "visceral_fat",    "lvl", lower_is_better=True)
            _diff_card(r2[2], "SMM",          "smm",             "kg",  lower_is_better=False)
            _diff_card(r2[3], "Body Water",   "total_body_water","L",   lower_is_better=False)
            st.divider()

        # ── Biological Age card ───────────────────────────────────────────────
        plan_bio_diff = plan_bio_age - chron_age
        if plan_bio_diff > 3:
            b_color, b_note = "#ef4444", f"Body is {plan_bio_diff} years OLDER than real age"
        elif plan_bio_diff < -3:
            b_color, b_note = "#22c55e", f"Body is {abs(plan_bio_diff)} years YOUNGER than real age"
        else:
            b_color, b_note = "#f59e0b", "Biological age is close to chronological age"

        bc1, bc2, bc3 = st.columns([1, 2, 1])
        with bc2:
            st.markdown(
                f"""<div style="background:#1e2130;border-radius:14px;padding:18px 22px;
                                border-left:5px solid #a855f7;text-align:center;margin-bottom:16px;">
                        <div style="color:#aab2cc;font-size:13px;margin-bottom:4px;">🧬 Biological Age</div>
                        <div style="color:#ffffff;font-size:36px;font-weight:800;">{plan_bio_age} <span style='font-size:18px;color:#a855f7;'>years</span></div>
                        <div style="color:{b_color};font-size:12px;margin-top:6px;">{b_note}</div>
                    </div>""",
                unsafe_allow_html=True,
            )

        # ── Styled Plan Renderer ──────────────────────────────────────────────
        st.subheader("🏆 Your AI Meal & Workout Plan")
        st.caption("✅ This plan has been automatically saved to your profile on the server.")
        _render_plan_cards(result)

        # ── PDF Download ──────────────────────────────────────────────────────
        st.divider()
        try:
            # Only regenerate PDF if we don't have cached bytes
            if st.session_state.last_pdf_bytes is None:
                st.session_state.last_pdf_bytes = generate_pdf_report(
                    weight=float(d["weight"]),
                    height=float(d["height"]),
                    age=int(d["age"]),
                    biological_age=int(d["biological_age"]),
                    gender=str(d["gender"]),
                    body_fat_pct=float(d["body_fat_pct"]),
                    body_fat_mass=float(d["body_fat_mass"]),
                    muscle_mass=float(d["muscle_mass"]),
                    smm=float(d["smm"]),
                    visceral_fat=float(d["visceral_fat"]),
                    bmr=float(d["bmr"]),
                    total_body_water=float(d["total_body_water"]),
                    goal=str(d["goal"]),
                    calories=int(d["calories"]),
                    protein=int(d["protein"]),
                    carbs=int(d["carbs"]),
                    fat=int(d["fat"]),
                    plan_text=result
                )

            st.download_button(
                label="📄 Download PDF Report",
                data=st.session_state.last_pdf_bytes,
                file_name="MuscleForge_Report.pdf",
                mime="application/pdf",
                use_container_width=True,
            )
        except Exception as e:
            st.warning(f"⚠️ Could not generate PDF: {e}")


# ===============================
# PROGRESS HISTORY PAGE
# ===============================

def progress_page():

    st.markdown('<p class="section-header">Progress History</p>', unsafe_allow_html=True)
    st.write("Track your InBody scan results over time.")
    st.divider()

    history = load_history()

    if not history:
        st.info("📭 No scan history yet. Go to **Meal Plan Generator**, fill in your InBody data, and click **💾 Save Scan to History**.")
        return

    # ---- METRICS CHART ----
    df = pd.DataFrame(history)
    df = df.iloc[::-1].reset_index(drop=True)  # oldest first for chart

    chart_cols = ["weight", "body_fat_pct", "muscle_mass", "bmr", "total_body_water"]
    available = [c for c in chart_cols if c in df.columns]

    if available:
        st.subheader("📈 Metrics Over Time")
        tab_names = {
            "weight": "⚖️ Weight",
            "body_fat_pct": "🔥 Body Fat %",
            "muscle_mass": "💪 Muscle Mass",
            "bmr": "🔋 BMR",
            "total_body_water": "💧 Body Water",
        }

        tabs = st.tabs([tab_names.get(c, c) for c in available])
        for tab, col in zip(tabs, available):
            with tab:
                chart_df = df[["timestamp", col]].copy()
                chart_df = chart_df.rename(columns={"timestamp": "Date", col: col.replace("_", " ").title()})
                st.line_chart(chart_df.set_index("Date"))

    st.divider()

    # ---- HISTORY TABLE ----
    st.subheader("📋 Scan Records")

    display_cols = {
        "timestamp": "Date",
        "weight": "Weight (kg)",
        "body_fat_pct": "Body Fat %",
        "body_fat_mass": "Fat Mass (kg)",
        "muscle_mass": "Muscle Mass (kg)",
        "smm": "Skeletal Muscle (kg)",
        "visceral_fat": "Visceral Fat",
        "bmr": "BMR (kcal)",
        "total_body_water": "Body Water (L)",
        "waist_cm": "Waist (cm)",
        "protein_mass": "Protein Mass (kg)",
    }

    table_df = pd.DataFrame(history)
    existing = {k: v for k, v in display_cols.items() if k in table_df.columns}
    table_df = table_df[list(existing.keys())].rename(columns=existing)

    st.dataframe(table_df, use_container_width=True, hide_index=True)

    st.divider()

    # ---- PROGRESS DELTA (latest vs previous) ----
    if len(history) >= 2:
        latest = history[0]   # newest
        prev   = history[1]   # second newest

        st.subheader(f"🔄 Progress: {prev.get('timestamp', 'prev')} → {latest.get('timestamp', 'now')}")

        def delta_metric(label: str, key: str, unit: str = "", lower_is_better: bool = False):
            try:
                cur_val = float(latest.get(key, 0))
                prv_val = float(prev.get(key, 0))
                diff = cur_val - prv_val
                delta_str = f"{'+' if diff >= 0 else ''}{diff:.2f} {unit}"
                color = "inverse" if lower_is_better else "normal"
                st.metric(label=label, value=f"{cur_val:.1f} {unit}", delta=delta_str, delta_color=color)
            except (TypeError, ValueError):
                st.metric(label=label, value="N/A")

        m1, m2, m3, m4 = st.columns(4)
        with m1:
            delta_metric("⚖️ Weight", "weight", "kg", lower_is_better=True)
        with m2:
            delta_metric("🔥 Body Fat %", "body_fat_pct", "%", lower_is_better=True)
        with m3:
            delta_metric("💪 Muscle Mass", "muscle_mass", "kg", lower_is_better=False)
        with m4:
            delta_metric("🔋 BMR", "bmr", "kcal", lower_is_better=False)

        m5, m6, m7, m8 = st.columns(4)
        with m5:
            delta_metric("🦴 Skeletal Muscle", "smm", "kg", lower_is_better=False)
        with m6:
            delta_metric("🫀 Visceral Fat", "visceral_fat", "", lower_is_better=True)
        with m7:
            delta_metric("💧 Body Water", "total_body_water", "L", lower_is_better=False)
        with m8:
            delta_metric("🍖 Fat Mass", "body_fat_mass", "kg", lower_is_better=True)

        m9, m10 = st.columns(4)[:2]
        with m9:
            delta_metric("📏 Waist", "waist_cm", "cm", lower_is_better=True)
        with m10:
            delta_metric("🥩 Protein Mass", "protein_mass", "kg", lower_is_better=False)


# ===============================
# SAVED PLANS PAGE
# ===============================

def saved_plans_page():

    st.markdown('<p class="section-header">📚 Saved Plans</p>', unsafe_allow_html=True)
    st.write("Your previously saved AI Meal & Workout plans.")
    st.divider()

    plans = load_plans()

    if not plans:
        st.info("📭 No saved plans yet. Generate a plan and click **💾 Save This Plan**.")
        return

    for i, plan_entry in enumerate(plans):
        ts = plan_entry.get("timestamp", "Unknown date")
        pd_meta = plan_entry.get("plan_data", {})
        goal = pd_meta.get("goal", "—")
        weight = pd_meta.get("weight", "—")
        calories = pd_meta.get("calories", "—")
        with st.expander(f"📋 {ts}  |  Goal: {goal.replace('_',' ').title()}  |  {weight} kg", expanded=False):
            col_info, col_del = st.columns([5, 1])
            with col_info:
                st.caption(f"Calories: {calories} kcal | Protein: {pd_meta.get('protein','—')}g | Carbs: {pd_meta.get('carbs','—')}g | Fat: {pd_meta.get('fat','—')}g")
            with col_del:
                if st.button("🗑️ Delete", key=f"del_plan_{i}"):
                    delete_plan(i)
                    st.success("Plan deleted.")
                    st.rerun()

            plan_text = plan_entry.get("plan_text", "")
            if plan_text:
                _render_plan_cards(plan_text)

                # PDF download for saved plan
                st.divider()
                try:
                    pdf_bytes = generate_pdf_report(
                        weight=float(pd_meta.get("weight", 0)),
                        height=float(pd_meta.get("height", 170)),
                        age=int(pd_meta.get("age", 25)),
                        biological_age=int(pd_meta.get("biological_age", 25)),
                        gender=str(pd_meta.get("gender", "male")),
                        body_fat_pct=float(pd_meta.get("body_fat_pct", 0)),
                        body_fat_mass=float(pd_meta.get("body_fat_mass", 0)),
                        muscle_mass=float(pd_meta.get("muscle_mass", 0)),
                        smm=float(pd_meta.get("smm", 0)),
                        visceral_fat=float(pd_meta.get("visceral_fat", 1)),
                        bmr=float(pd_meta.get("bmr", 0)),
                        total_body_water=float(pd_meta.get("total_body_water", 0)),
                        goal=str(pd_meta.get("goal", "balanced")),
                        calories=int(pd_meta.get("calories", 0)),
                        protein=int(pd_meta.get("protein", 0)),
                        carbs=int(pd_meta.get("carbs", 0)),
                        fat=int(pd_meta.get("fat", 0)),
                        plan_text=plan_text
                    )
                    st.download_button(
                        label="📄 Download PDF",
                        data=pdf_bytes,
                        file_name=f"MuscleForge_{ts.replace(':', '-').replace(' ', '_')}.pdf",
                        mime="application/pdf",
                        key=f"pdf_saved_{i}",
                    )
                except Exception as e:
                    st.warning(f"⚠️ PDF generation failed: {e}")
            else:
                st.warning("No plan text stored for this entry.")


# ===============================
# CHAT PAGE
# ===============================

def chat_page():

    st.markdown('<p class="section-header">AI Gym Coach Chat</p>', unsafe_allow_html=True)
    st.write("Ask your AI fitness coach anything about training, nutrition or gym.")

    # ── Build context from session state ─────────────────────────────────────
    chat_context = None
    if st.session_state.last_plan_data:
        d = st.session_state.last_plan_data
        chat_context = {
            "inbody": {
                "weight":            d.get("weight"),
                "height":            d.get("height"),
                "age":               d.get("age"),
                "gender":            d.get("gender"),
                "biological_age":    d.get("biological_age"),
                "body_fat_pct":      d.get("body_fat_pct"),
                "body_fat_mass":     d.get("body_fat_mass"),
                "muscle_mass":       d.get("muscle_mass"),
                "smm":               d.get("smm"),
                "visceral_fat":      d.get("visceral_fat"),
                "bmr":               d.get("bmr"),
                "total_body_water":  d.get("total_body_water"),
                "waist_cm":          d.get("waist_cm"),
                "disease":           d.get("disease"),
                "allergies":         d.get("allergies"),
            },
            "goal":      d.get("goal"),
            "plan_text": st.session_state.last_plan_result,
        }
        st.info(
            f"🔗 **Coach is aware of your profile** — "
            f"{d.get('weight','?')} kg | {d.get('body_fat_pct','?')}% body fat | "
            f"Goal: {str(d.get('goal','')).replace('_',' ').title()} | "
            f"BMR: {d.get('bmr','?')} kcal"
        )
    else:
        st.warning("⚠️ No plan generated yet — generate a Meal & Workout Plan first so the coach knows your profile.")

    for msg in st.session_state.messages:
        st.chat_message(msg["role"]).write(msg["content"])

    prompt = st.chat_input("Ask the AI coach...")

    if prompt:
        st.session_state.messages.append({"role": "user", "content": prompt})
        st.chat_message("user").write(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                response = gym_chatbot(
                    prompt,
                    history=st.session_state.messages,
                    context=chat_context,
                )
            st.markdown(response)

        st.session_state.messages.append({"role": "assistant", "content": response})

    if st.session_state.messages:
        if st.button("🗑️ Clear Chat"):
            st.session_state.messages = []
            st.rerun()


# ===============================
# ROUTER
# ===============================

page = st.session_state.get("page", "meal")

if page == "meal":
    meal_plan_page()
elif page == "progress":
    progress_page()
elif page == "saved":
    saved_plans_page()
else:
    chat_page()