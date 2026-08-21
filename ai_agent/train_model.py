import os
import shutil
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix

# ──────────────────────────────────────────────────────────────────────────────
# Load dataset
# ──────────────────────────────────────────────────────────────────────────────
print("Loading final dataset...")
df = pd.read_csv("nhanes_final_dataset.csv")

# ──────────────────────────────────────────────────────────────────────────────
# Encode gender
# ──────────────────────────────────────────────────────────────────────────────
gender_encoder = LabelEncoder()
df["gender"] = gender_encoder.fit_transform(df["gender"])

# ──────────────────────────────────────────────────────────────────────────────
# Features
# ──────────────────────────────────────────────────────────────────────────────
features = [
    "age", "gender", "weight", "height", "bmi", "waist",
    "bodyfat_pct", "lean_mass", "activity_score", "sleep_quality",
    "calories", "protein", "carbs", "fat",
]

X = df[features]
y = df["goal"]

print(f"Dataset size  : {X.shape}")
print(f"Class balance :\n{y.value_counts()}\n")

# ──────────────────────────────────────────────────────────────────────────────
# Train / Test split  (same seed as always for reproducibility)
# ──────────────────────────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# ──────────────────────────────────────────────────────────────────────────────
# GridSearchCV to find best hyperparameters
# ── Cross-validation confirms the model is already near-perfect, so we search
#    a small grid to confirm optimal params and keep the model reproducible.
# ──────────────────────────────────────────────────────────────────────────────
print("Running GridSearchCV (this may take a few minutes)...")

param_grid = {
    "n_estimators": [200, 300, 400],
    "max_depth": [None, 20, 30],
    "min_samples_leaf": [1, 2, 4],
}

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

gs = GridSearchCV(
    RandomForestClassifier(class_weight="balanced", random_state=42),
    param_grid=param_grid,
    cv=cv,
    scoring="f1_macro",
    n_jobs=-1,
    verbose=1,
)

gs.fit(X_train, y_train)

print(f"\nBest params   : {gs.best_params_}")
print(f"Best CV F1    : {gs.best_score_:.4f}")

model = gs.best_estimator_

# ──────────────────────────────────────────────────────────────────────────────
# Evaluate on hold-out test set
# ──────────────────────────────────────────────────────────────────────────────
pred = model.predict(X_test)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, pred, labels=model.classes_))

print("\nClassification Report:")
print(classification_report(y_test, pred, digits=4))

# ──────────────────────────────────────────────────────────────────────────────
# Safety check before saving
# ──────────────────────────────────────────────────────────────────────────────
from sklearn.metrics import f1_score

f1 = f1_score(y_test, pred, average="macro")
if f1 < 0.75:
    print(f"[WARNING] Macro F1 = {f1:.4f} is below the 0.75 safety threshold.")
    print("         Model NOT saved. Review training data or parameters.")
else:
    # Backup old model
    if os.path.exists("goal_model.pkl"):
        shutil.copy("goal_model.pkl", "goal_model_backup.pkl")
        print("\n[OK] Old model backed up to goal_model_backup.pkl")

    joblib.dump(model, "goal_model.pkl")
    joblib.dump(gender_encoder, "gender_encoder.pkl")
    print(f"[OK] New model saved (macro F1 = {f1:.4f})")
    print("\nModel saved successfully.")