import pandas as pd

print("Loading merged dataset...")

df = pd.read_csv("nhanes_merged_dataset.csv")

# --------------------------------
# Activity Score
# --------------------------------
df["activity_score"] = df["moderate_days"].fillna(0) + (df["vigorous_days"].fillna(0) * 2)

# --------------------------------
# Sleep Quality
# --------------------------------
df["sleep_quality"] = df["sleep_hours"]

# --------------------------------
# Weight Change
# --------------------------------
df["weight_change"] = df["weight"] - df["weight_last_year"]

# --------------------------------
# Check body fat distribution
# --------------------------------
print("\nBody Fat Distribution:")
print(df["bodyfat_pct"].describe())

# --------------------------------
# Goal Classification
# --------------------------------
def classify_goal(row):

    bf = row["bodyfat_pct"]
    bmi = row["bmi"]
    activity = row["activity_score"]

    # In nhanes dataset:
    # activity_score is days * min, meaning median is 0, 75th is 180.
    # We map 0 as sedentary, <60 as light, 60-150 moderate, >150 active
    
    # 1. Aggressive Fat Loss (Obesity / Very High Body Fat)
    if bf > 25.5 or bmi >= 32:
        return "aggressive_fat_loss"

    # 2. Fat Loss (Overweight / High Body Fat)
    if bf >= 24.5 or bmi >= 26:
        return "fat_loss"

    # 3. Muscle Gain (Underweight)
    if bmi < 21:
        return "muscle_gain"

    # 4. Athletic Performance (High Activity + Good BMI/BF)
    if activity >= 150 and bf < 23.5 and bmi < 25:
        return "athletic_performance"

    # 5. Lean Muscle Gain (Moderate/High Activity + Normal Stats)
    if activity >= 60 and bf < 24 and bmi < 25:
        return "lean_muscle_gain"

    # 6. Body Recomposition (Skinny Fat / Moderate Activity)
    if activity <= 60 and bf >= 23.5 and bmi < 26:
        return "body_recomposition"

    # 7. Maintenance (Default for healthy, active individuals not fitting extremes)
    return "maintenance"


df["goal"] = df.apply(classify_goal, axis=1)

# --------------------------------
# Remove rows with missing critical values
# --------------------------------
df = df.dropna(subset=[
    "weight",
    "height",
    "bodyfat_pct",
    "lean_mass"
])

# --------------------------------
# Save final dataset
# --------------------------------
df.to_csv("nhanes_final_dataset.csv", index=False)

print("\nFinal dataset created.")
print("Shape:", df.shape)

print("\nGoal distribution:")
print(df["goal"].value_counts())