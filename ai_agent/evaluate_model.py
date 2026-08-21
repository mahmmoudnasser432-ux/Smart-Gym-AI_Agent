"""
evaluate_model.py
-----------------
Diagnostic script for the goal prediction Random Forest model.
Runs:
  1. Stratified 5-fold cross-validation  → prints mean/std accuracy
  2. Per-class classification report     → prints precision/recall/F1
  3. Confusion matrix                    → prints the matrix
  4. Learning curves                     → saves model_learning_curve.png

Run this BEFORE and AFTER retraining to compare results.
"""

import joblib
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")  # non-interactive backend (no display needed)
import matplotlib.pyplot as plt

from sklearn.model_selection import (
    StratifiedKFold, cross_validate, learning_curve
)
from sklearn.metrics import (
    classification_report, confusion_matrix, ConfusionMatrixDisplay
)

# ──────────────────────────────────────────────────────────────────────────────
# Load data + model
# ──────────────────────────────────────────────────────────────────────────────

print("Loading dataset and model...")

df = pd.read_csv("nhanes_final_dataset.csv")

features = [
    "age", "gender", "weight", "height", "bmi", "waist",
    "bodyfat_pct", "lean_mass", "activity_score", "sleep_quality",
    "calories", "protein", "carbs", "fat",
]

X = df[features].copy()
y = df["goal"]

# Encode gender the same way train_model.py does
from sklearn.preprocessing import LabelEncoder
le = LabelEncoder()
X["gender"] = le.fit_transform(X["gender"].astype(str))

model = joblib.load("goal_model.pkl")

print(f"Model type    : {type(model).__name__}")
print(f"Dataset shape : {X.shape}")
print(f"Class counts  :\n{y.value_counts()}")
print()

# ──────────────────────────────────────────────────────────────────────────────
# 1. Stratified 5-fold CV
# ──────────────────────────────────────────────────────────────────────────────

print("=" * 60)
print("  STRATIFIED 5-FOLD CROSS-VALIDATION")
print("=" * 60)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

cv_results = cross_validate(
    model, X, y,
    cv=cv,
    scoring=["accuracy", "f1_macro"],
    return_train_score=True,
    n_jobs=-1,
)

train_acc = cv_results["train_accuracy"]
val_acc   = cv_results["test_accuracy"]
train_f1  = cv_results["train_f1_macro"]
val_f1    = cv_results["test_f1_macro"]

print(f"  Train Accuracy : {train_acc.mean():.4f} ± {train_acc.std():.4f}")
print(f"  Val   Accuracy : {val_acc.mean():.4f}   ± {val_acc.std():.4f}")
print(f"  Train F1 macro : {train_f1.mean():.4f} ± {train_f1.std():.4f}")
print(f"  Val   F1 macro : {val_f1.mean():.4f}   ± {val_f1.std():.4f}")

gap = train_acc.mean() - val_acc.mean()
if gap > 0.10:
    print(f"\n  [WARNING] OVERFITTING DETECTED  (gap = {gap:.4f})")
elif val_acc.mean() < 0.70:
    print(f"\n  [WARNING] POSSIBLE UNDERFITTING (val acc = {val_acc.mean():.4f})")
else:
    print(f"\n  [OK] Model looks HEALTHY  (gap = {gap:.4f})")

print()

# ──────────────────────────────────────────────────────────────────────────────
# 2. Full hold-out evaluation (re-split same seed as train_model.py)
# ──────────────────────────────────────────────────────────────────────────────

from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

pred = model.predict(X_test)

print("=" * 60)
print("  HOLD-OUT TEST SET REPORT")
print("=" * 60)
print(classification_report(y_test, pred))

print("  Confusion Matrix:")
cm = confusion_matrix(y_test, pred, labels=model.classes_)
print(cm)
print()

# ──────────────────────────────────────────────────────────────────────────────
# 3. Learning curves
# ──────────────────────────────────────────────────────────────────────────────

print("Generating learning curves (this may take a minute)...")

train_sizes, train_scores, val_scores = learning_curve(
    model, X, y,
    cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
    scoring="accuracy",
    train_sizes=np.linspace(0.1, 1.0, 10),
    n_jobs=-1,
)

train_mean = train_scores.mean(axis=1)
train_std  = train_scores.std(axis=1)
val_mean   = val_scores.mean(axis=1)
val_std    = val_scores.std(axis=1)

fig, ax = plt.subplots(figsize=(9, 5))
ax.plot(train_sizes, train_mean, "o-", color="#4f8ef7", label="Training accuracy")
ax.fill_between(train_sizes, train_mean - train_std, train_mean + train_std,
                alpha=0.15, color="#4f8ef7")
ax.plot(train_sizes, val_mean, "s-", color="#a855f7", label="Validation accuracy")
ax.fill_between(train_sizes, val_mean - val_std, val_mean + val_std,
                alpha=0.15, color="#a855f7")

ax.set_xlabel("Training set size", fontsize=12)
ax.set_ylabel("Accuracy", fontsize=12)
ax.set_title("Learning Curves — Goal Prediction Model", fontsize=14, fontweight="bold")
ax.legend(loc="lower right")
ax.grid(True, alpha=0.3)
ax.set_ylim(0.5, 1.05)

plt.tight_layout()
plt.savefig("model_learning_curve.png", dpi=150)
plt.close()

print("  Learning curve saved -> model_learning_curve.png")
print()
print("Evaluation complete.")
