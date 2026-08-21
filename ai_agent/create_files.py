import pandas as pd
import os

print("\n🚀 Creating required dataset files...")

# ========================================
# Create CGMacros template
# ========================================
cg_columns = [
    "weight_kg",
    "height_cm",
    "BF_pct",
    "energy",
    "protein",
    "carbs",
    "fat",
    "age",
    "gender",
    "activity_level"
]

cg = pd.DataFrame(columns=cg_columns)
cg.to_csv("CGMacros.csv", index=False)
print("✔ CGMacros.csv created")


# ========================================
# Create NHANES Body Composition Template
# ========================================
nh_body_columns = [
    "SEQN",
    "Weight_kg",
    "Height_cm",
    "BodyFatPct",
    "DXA_MuscleMass",
    "VisceralFat",
]

nh_body = pd.DataFrame(columns=nh_body_columns)
nh_body.to_csv("NHANES_body.csv", index=False)
print("✔ NHANES_body.csv created")


# ========================================
# Create NHANES Nutrition Template
# ========================================
nh_nutrition_columns = [
    "SEQN",
    "Calories",
    "Protein_g",
    "Carb_g",
    "Fat_g",
    "Fiber_g",
    "Sugar_g"
]

nh_nutrition = pd.DataFrame(columns=nh_nutrition_columns)
nh_nutrition.to_csv("NHANES_nutrition.csv", index=False)
print("✔ NHANES_nutrition.csv created")


# ========================================
# Create NHANES Demographic Template
# ========================================
nh_demo_columns = [
    "SEQN",
    "Gender",
    "Age"
]

nh_demo = pd.DataFrame(columns=nh_demo_columns)
nh_demo.to_csv("NHANES_demo.csv", index=False)
print("✔ NHANES_demo.csv created")


print("\n🎉 ALL FILES CREATED SUCCESSFULLY!")
print("Files created:")
print(" - CGMacros.csv")
print(" - NHANES_body.csv")
print(" - NHANES_nutrition.csv")
print(" - NHANES_demo.csv")
