# debug_prompt.py — build & print prompt (no call to LLaMA)
data = {
    "weight": 80.0,
    "height": 175.0,
    "age": 25,
    "gender": "Male",
    "protein_g": 120,
    "carb_g": 250,
    "fat_g": 70,
    "body_fat_mass": 12.0,
    "body_fat_pct": 18.0,
    "total_body_water": 40.0,
    "protein_mass": 10.0,
    "smm": 32.0,
    "visceral_fat": 8,
    "muscle_mass": 60.0,
    "bmr": 1700,
    "activity_level": "sedentary",
    "goal": "fat_loss",
    "training_frequency": 3,
    "waist_cm": 90.0,
    "allergies": "none",
    "disease": "none",
    "ml_goal": "fat_loss"
}

prompt = f"""
SYSTEM: You are MuscleForge AI — a certified gym coach and nutrition expert.

USER DATA:
- Weight (kg): {data['weight']}
- Height (cm): {data['height']}
- Age: {data['age']}
- Gender: {data['gender']}
- Activity Level: {data['activity_level']}
- Goal: {data['goal']}
- Training Frequency (per week): {data['training_frequency']}
- Waist (cm): {data['waist_cm']}
- Allergies/Diet restrictions: {data['allergies']}

INBODY:
- Body Fat %: {data['body_fat_pct']}
- Body Fat Mass (kg): {data['body_fat_mass']}
- Skeletal Muscle Mass (SMM kg): {data['smm']}
- Muscle Mass (kg): {data['muscle_mass']}
- Total Body Water (L): {data['total_body_water']}
- Protein Mass (kg): {data['protein_mass']}
- Visceral Fat Level: {data['visceral_fat']}
- BMR (kcal): {data['bmr']}

TASK: Generate caloric target, macros, 5-meal plan, and weekly workout split.
"""
print("\n--- PROMPT (preview) ---\n")
print(prompt)
print("\n--- END PROMPT ---\n")
