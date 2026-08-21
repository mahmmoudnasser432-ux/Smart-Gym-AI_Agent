"""
adaptive_planner.py — Compares current InBody scan vs previous scan
and produces a progress summary that can be injected into the LLM prompt.
"""

from typing import Dict, Any, Optional


def compute_progress(
    current: Dict[str, Any],
    previous: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Compute deltas between two InBody scans.
    Returns a dict with change values and direction labels.
    Positive delta = improvement direction depends on metric.
    """

    def delta(key: str) -> Optional[float]:
        try:
            val = float(current.get(key, 0)) - float(previous.get(key, 0))
            return float(f"{val:.2f}")
        except (TypeError, ValueError):
            return None

    weight_d       = delta("weight")
    fat_mass_d     = delta("body_fat_mass")
    fat_pct_d      = delta("body_fat_pct")
    muscle_d       = delta("muscle_mass")
    smm_d          = delta("smm")
    visceral_d     = delta("visceral_fat")
    bmr_d          = delta("bmr")
    tbw_d          = delta("total_body_water")

    def sign(val, positive_is_good: bool) -> str:
        if val is None:
            return "unchanged"
        if val > 0:
            return "increased ✅" if positive_is_good else "increased ⚠️"
        if val < 0:
            return "decreased ✅" if not positive_is_good else "decreased ⚠️"
        return "unchanged"

    progress = {
        "prev_timestamp": previous.get("timestamp", "previous scan"),
        "weight_delta":       weight_d,
        "weight_direction":   sign(weight_d, False),       # lower weight = good for fat loss context
        "fat_mass_delta":     fat_mass_d,
        "fat_mass_direction": sign(fat_mass_d, False),     # less fat = good
        "fat_pct_delta":      fat_pct_d,
        "fat_pct_direction":  sign(fat_pct_d, False),
        "muscle_delta":       muscle_d,
        "muscle_direction":   sign(muscle_d, True),        # more muscle = good
        "smm_delta":          smm_d,
        "smm_direction":      sign(smm_d, True),
        "visceral_delta":     visceral_d,
        "visceral_direction": sign(visceral_d, False),     # less visceral fat = good
        "bmr_delta":          bmr_d,
        "bmr_direction":      sign(bmr_d, True),           # higher BMR = more metabolic activity
        "tbw_delta":          tbw_d,
        "tbw_direction":      sign(tbw_d, True),
    }

    return progress


def format_progress_for_prompt(progress: Dict[str, Any]) -> str:
    """
    Returns a formatted text block to inject into the LLM prompt,
    describing measured changes since the last InBody scan.
    """

    def fmt(val, unit="kg") -> str:
        if val is None:
            return "N/A"
        sign_str = "+" if val > 0 else ""
        return f"{sign_str}{val} {unit}"

    block = f"""
---------------------------------
PROGRESS SINCE LAST SCAN ({progress.get('prev_timestamp', 'N/A')})
---------------------------------

Weight Change:          {fmt(progress['weight_delta'])} ({progress['weight_direction']})
Body Fat Mass Change:   {fmt(progress['fat_mass_delta'])} ({progress['fat_mass_direction']})
Body Fat % Change:      {fmt(progress['fat_pct_delta'], '%')} ({progress['fat_pct_direction']})
Muscle Mass Change:     {fmt(progress['muscle_delta'])} ({progress['muscle_direction']})
Skeletal Muscle Change: {fmt(progress['smm_delta'])} ({progress['smm_direction']})
Visceral Fat Change:    {fmt(progress['visceral_delta'], 'level')} ({progress['visceral_direction']})
BMR Change:             {fmt(progress['bmr_delta'], 'kcal')} ({progress['bmr_direction']})
Total Body Water:       {fmt(progress['tbw_delta'], 'L')} ({progress['tbw_direction']})

(IMPORTANT: Use this real measured progress data to adapt the coaching plan.
Reference specific numbers. Acknowledge improvements, flag areas that still need work,
and adjust intensity/calories/macros accordingly. Start the plan with a brief
"Since your last scan..." progress summary.)
"""
    return block
