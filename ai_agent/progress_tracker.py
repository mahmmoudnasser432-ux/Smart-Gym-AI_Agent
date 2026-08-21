"""
progress_tracker.py — Saves and loads InBody scan history locally.
Each scan is stored as a JSON entry with a timestamp.
"""

import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any

HISTORY_FILE = os.path.join(os.path.dirname(__file__), "inbody_history.json")


def _load_raw() -> List[Dict[str, Any]]:
    """Load raw list from JSON file. Returns empty list if file missing."""
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError):
        return []


def _save_raw(records: List[Dict[str, Any]]) -> None:
    """Persist list back to JSON file."""
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)


def save_scan(scan: Dict[str, Any]) -> None:
    """
    Append a new InBody scan to history with a timestamp.
    The scan dict should contain the same keys used by full_agent().
    """
    records = _load_raw()
    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        **scan
    }
    records.append(entry)
    _save_raw(records)


def load_history() -> List[Dict[str, Any]]:
    """Return all saved scans, newest first."""
    records = _load_raw()
    return list(reversed(records))


def get_last_scan() -> Optional[Dict[str, Any]]:
    """Return the most recent saved scan, or None if no history."""
    records = _load_raw()
    if not records:
        return None
    return records[-1]


def delete_all_history() -> None:
    """Wipe all saved scans (used for testing)."""
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)
