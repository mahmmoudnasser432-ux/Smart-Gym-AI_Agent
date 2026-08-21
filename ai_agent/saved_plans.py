"""
saved_plans.py
--------------
Saves and loads AI-generated Meal & Workout plans locally.
Each entry stores the full plan text, metadata, and timestamp.
"""

import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any

PLANS_FILE = os.path.join(os.path.dirname(__file__), "saved_plans.json")


def _load_raw() -> List[Dict[str, Any]]:
    """Load raw list from JSON file. Returns empty list if file missing."""
    if not os.path.exists(PLANS_FILE):
        return []
    try:
        with open(PLANS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError):
        return []


def _save_raw(records: List[Dict[str, Any]]) -> None:
    """Persist list back to JSON file."""
    with open(PLANS_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)


def save_plan(result: str, plan_data: dict) -> None:
    """
    Save a generated plan to history with a timestamp.
    
    Args:
        result: The raw plan text from the LLM
        plan_data: The plan metadata dict (weight, calories, goal, etc.)
    """
    records = _load_raw()
    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "plan_text": result,
        "plan_data": plan_data,
    }
    records.append(entry)
    _save_raw(records)


def load_plans() -> List[Dict[str, Any]]:
    """Return all saved plans, newest first."""
    records = _load_raw()
    return list(reversed(records))


def delete_plan(index_from_newest: int) -> bool:
    """
    Delete a plan by its position in the newest-first list.
    Returns True if deleted, False if index out of range.
    """
    records = _load_raw()
    # Convert newest-first index to oldest-first index
    raw_index = len(records) - 1 - index_from_newest
    if 0 <= raw_index < len(records):
        records.pop(raw_index)
        _save_raw(records)
        return True
    return False


def delete_all_plans() -> None:
    """Wipe all saved plans."""
    if os.path.exists(PLANS_FILE):
        os.remove(PLANS_FILE)
