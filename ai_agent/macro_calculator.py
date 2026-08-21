def calculate_calories(bmr: float, activity_level: str, goal: str) -> int:
    """
    Calculate daily calorie target based on BMR, activity level, and goal.
    Raises ValueError on invalid inputs.
    """
    if bmr <= 0:
        raise ValueError(f"BMR must be positive, got {bmr}")

    activity_map = {
        "sedentary": 1.2,
        "light": 1.37,
        "moderate": 1.55,
        "active": 1.72,
        "athlete": 1.9
    }

    multiplier = activity_map.get(activity_level.lower(), 1.55)
    tdee = bmr * multiplier

    if goal == "aggressive_fat_loss":
        calories = tdee - 750
    elif goal == "fat_loss":
        calories = tdee - 500
    elif goal == "body_recomposition":
        calories = tdee - 200
    elif goal == "athletic_performance":
        calories = tdee + 200
    elif goal == "lean_muscle_gain":
        calories = tdee + 250
    elif goal == "muscle_gain":
        calories = tdee + 500
    else:
        calories = tdee  # maintenance

    # Never return fewer than 1000 kcal for safety
    return max(1000, round(calories))


def calculate_macros(weight: float, calories: int, goal: str) -> dict:
    """
    Calculate protein / carbs / fat targets.
    Clamps carbs to >= 0 to prevent negative values at extreme deficits.
    """
    if weight <= 0:
        raise ValueError(f"Weight must be positive, got {weight}")

    if goal == "aggressive_fat_loss":
        protein = weight * 2.4  # Higher protein to preserve muscle in massive deficit
    elif goal == "fat_loss":
        protein = weight * 2.2
    elif goal == "body_recomposition":
        protein = weight * 2.2  # High protein to build muscle while losing fat
    elif goal in ("athletic_performance", "lean_muscle_gain"):
        protein = weight * 2.0
    elif goal == "muscle_gain":
        protein = weight * 1.8  # Enough protein, more focus on carbs for energy
    else:
        protein = weight * 1.8  # maintenance

    fat = weight * 0.8

    remaining_calories = calories - (protein * 4 + fat * 9)

    # Clamp carbs to minimum 30g — can happen at very aggressive deficits
    carbs = max(30.0, remaining_calories / 4)

    return {
        "protein": round(protein),
        "carbs": round(carbs),
        "fat": round(fat)
    }