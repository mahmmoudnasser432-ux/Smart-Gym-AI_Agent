"""
biological_age.py
-----------------
Estimates biological age from InBody body-composition metrics.

Formula logic (evidence-based heuristics):

    Start with chronological age as a baseline, then:

    1. Body Fat % penalty/bonus
       - Body fat % adds years above a healthy range, subtracts years below.
       - Reference healthy ranges: Male 8-19%, Female 18-28%

    2. Visceral Fat penalty
       - Each unit above 9 adds extra years.

    3. Skeletal Muscle Mass (SMM) bonus
       - Compare actual SMM to "expected" SMM for age/gender.
       - Higher-than-expected SMM → subtract years.

    4. BMR deviation bonus/penalty
       - Compare actual BMR to Mifflin-St Jeor predicted BMR for the person.
       - A higher BMR means a more metabolically active body → subtract years.

The formula is conservative on purpose — it rounds to the nearest year and
clamps the output to [chronological_age - 15, chronological_age + 20].
"""


def _mifflin_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    """Calculate Mifflin-St Jeor predicted BMR."""
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    if gender.strip().lower() in {"male", "m"}:
        return base + 5
    else:
        return base - 161


def _expected_smm(age: int, weight_kg: float, gender: str) -> float:
    """
    Simple expected Skeletal Muscle Mass based on weight and gender.
    Males: ~42% of body weight up to 40 yrs, declines 1% per decade after.
    Females: ~35% of body weight up to 40 yrs, declines 1% per decade after.
    """
    base_pct = 0.42 if gender.strip().lower() in {"male", "m"} else 0.35
    decades_over_40 = max(0, (age - 40) / 10)
    adjusted_pct = base_pct - 0.01 * decades_over_40
    return weight_kg * adjusted_pct


def _healthy_bf_range(gender: str) -> tuple:
    """Return (low, high) healthy body fat % for this gender."""
    if gender.strip().lower() in {"male", "m"}:
        return (8.0, 19.0)
    else:
        return (18.0, 28.0)


def calculate_biological_age(
    chronological_age: int,
    gender: str,
    weight_kg: float,
    height_cm: float,
    body_fat_pct: float,
    smm_kg: float,
    visceral_fat: int,
    bmr: float,
) -> int:
    """
    Estimate biological age from body composition data.

    Parameters
    ----------
    chronological_age : int  — actual age in years
    gender            : str  — "male" or "female"
    weight_kg         : float
    height_cm         : float
    body_fat_pct      : float — body fat percentage (e.g. 24.0)
    smm_kg            : float — skeletal muscle mass in kg
    visceral_fat      : int   — visceral fat level (1–30)
    bmr               : float — measured BMR in kcal

    Returns
    -------
    int — estimated biological age in years
    """
    delta = 0.0  # positive = biologically older, negative = biologically younger

    # ── 1. Body Fat % ──────────────────────────────────────────────────────
    bf_low, bf_high = _healthy_bf_range(gender)
    if body_fat_pct > bf_high:
        # Each 2 % above healthy ceiling adds 1 year (up to +8)
        delta += min(8.0, (body_fat_pct - bf_high) / 2.0)
    elif body_fat_pct < bf_low:
        # Very low body fat also adds a small penalty (muscular / athletic athletes excluded by SMM bonus)
        delta += min(3.0, (bf_low - body_fat_pct) / 3.0)
    else:
        # Solidly in healthy range → −1 year bonus
        delta -= 1.0

    # ── 2. Visceral Fat ────────────────────────────────────────────────────
    # Level ≤ 9 is healthy; each unit above adds 0.6 years (up to +7)
    if visceral_fat > 9:
        delta += min(7.0, (visceral_fat - 9) * 0.6)
    else:
        delta -= 0.5  # healthy level → small bonus

    # ── 3. Skeletal Muscle Mass ────────────────────────────────────────────
    expected_smm = _expected_smm(chronological_age, weight_kg, gender)
    smm_ratio = smm_kg / expected_smm if expected_smm > 0 else 1.0
    if smm_ratio >= 1.10:
        delta -= min(5.0, (smm_ratio - 1.0) * 15)   # well above expected → up to −5 years
    elif smm_ratio <= 0.90:
        delta += min(5.0, (1.0 - smm_ratio) * 15)   # well below expected → up to +5 years

    # ── 4. BMR deviation from Mifflin-St Jeor ─────────────────────────────
    predicted_bmr = _mifflin_bmr(weight_kg, height_cm, chronological_age, gender)
    bmr_ratio = bmr / predicted_bmr if predicted_bmr > 0 else 1.0
    if bmr_ratio >= 1.05:
        delta -= min(3.0, (bmr_ratio - 1.0) * 20)   # higher BMR → younger
    elif bmr_ratio <= 0.95:
        delta += min(3.0, (1.0 - bmr_ratio) * 20)   # lower BMR → older

    # ── Final calculation ──────────────────────────────────────────────────
    bio_age = chronological_age + delta

    # Clamp: never more than 20 years older or 15 years younger
    bio_age = max(chronological_age - 15, min(chronological_age + 20, bio_age))

    return round(bio_age)


# ──────────────────────────────────────────────────────────────────────────────
# Self-test
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    tests = [
        {
            "label": "Obese/Sedentary (should be OLDER than real age)",
            "chronological_age": 30,
            "gender": "male",
            "weight_kg": 105,
            "height_cm": 175,
            "body_fat_pct": 36,
            "smm_kg": 28,
            "visceral_fat": 16,
            "bmr": 1650,
        },
        {
            "label": "Athletic (should be YOUNGER than real age)",
            "chronological_age": 35,
            "gender": "male",
            "weight_kg": 85,
            "height_cm": 180,
            "body_fat_pct": 12,
            "smm_kg": 40,
            "visceral_fat": 5,
            "bmr": 2050,
        },
        {
            "label": "Average woman (should be CLOSE to real age)",
            "chronological_age": 28,
            "gender": "female",
            "weight_kg": 65,
            "height_cm": 165,
            "body_fat_pct": 24,
            "smm_kg": 22,
            "visceral_fat": 7,
            "bmr": 1400,
        },
    ]

    for t in tests:
        label = t.pop("label")
        bio = calculate_biological_age(**t)
        real = t["chronological_age"]
        diff = bio - real
        sign = f"+{diff}" if diff >= 0 else str(diff)
        print(f"[{label}]")
        print(f"  Chronological age : {real}")
        print(f"  Biological age    : {bio}  ({sign} years)")
        print()
