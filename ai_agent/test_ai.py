import requests
import json

payload = {
    "weight": 80.0,
    "height": 175.0,
    "age": 25,
    "gender": "male",
    "body_fat_mass": 15.0,
    "body_fat_pct": 18.0,
    "total_body_water": 45.0,
    "protein_mass": 14.0,
    "smm": 35.0,
    "visceral_fat": 7.0,
    "muscle_mass": 36.0,
    "bmr": 1800.0,
    "activity_level": "moderate",
    "training_frequency": 4,
    "waist_cm": 85.0,
    "allergies": "none",
    "disease": "none",
    "budget": "moderate"
}

try:
    response = requests.post("http://localhost:8000/generate-plan", json=payload, timeout=120)
    print("Status Code:", response.status_code)
    
    if response.status_code == 200:
        data = response.json()
        print("\n--- Plan Data (Returned to Streamlit/UI) ---")
        print(json.dumps(data.get("plan_data", {}), indent=2))
        
        print("\n--- Raw Plan Text ---")
        print(data.get("plan_text", ""))

        print("\n--- Parsed Plan (Returned to Backend/Flutter) ---")
        parsed = data.get("parsed_plan", {})
        
        print("\n--- Parsed Plan Full JSON ---")
        print(json.dumps(parsed, indent=2))
    else:
        print("Error Response:", response.text)
        
except Exception as e:
    print("Request failed:", str(e))

