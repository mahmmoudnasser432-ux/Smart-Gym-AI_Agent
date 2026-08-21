from main import _run_agent, PlanRequest
import json

req = PlanRequest(weight=85, height=175, age=50, gender='female', body_fat_mass=16.2, body_fat_pct=25, total_body_water=35, protein_mass=12, smm=21, visceral_fat=6, muscle_mass=25, bmr=1400, training_frequency=4)

try:
    res = _run_agent(req)
    print("\n--- RAW AI TEXT ---")
    print(res["plan_text"])
    print("\n--- PARSED JSON ---")
    print(json.dumps(res["parsed_plan"], indent=2))
except Exception as e:
    print("Error:", e)
