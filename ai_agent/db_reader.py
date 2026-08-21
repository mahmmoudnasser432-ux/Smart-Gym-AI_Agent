"""
db_reader.py
------------
Fetches the latest InBody scan for the specified user ID
from the SmartGym Node.js backend via HTTP.

Endpoint:  GET /api/ai/public/inbody/latest?userId=1
Host:      http://192.168.1.10:8000
Auth:      Bearer JWT Token

Response shape expected:
{
  "status": "success",
  "data": {
    "scan_id":          "uuid",
    "weight_kg":        80,
    "height_cm":        175,
    "body_fat_pct":     18,
    "muscle_mass":      34,
    "smm":              32,
    "protein_mass":     11,
    "total_body_water": 42,
    "visceral_fat":     8,
    "bmr":              1750,
    "waist_cm":         84,
    "biological_age":   24,
    "predicted_goal":   "balanced",
    "scan_timestamp":   "..."
  }
}
"""

import os
import requests
from typing import Optional, Dict, Any

# ─────────────────────────────────────────────
#  ✅ Backend server configuration
# ─────────────────────────────────────────────
BACKEND_HOST = os.getenv("BACKEND_HOST", "http://localhost:5000").rstrip("/")
SCAN_ENDPOINT = f"{BACKEND_HOST}/api/ai/public/inbody/latest"
REQUEST_TIMEOUT = 8   # seconds
# ─────────────────────────────────────────────


def get_latest_inbody(user_id: int, token: str = "") -> Optional[Dict[str, Any]]:
    """
    Fetch the most recent InBody scan for the user ID.

    Parameters
    ----------
    user_id : int — The ID of the gym user
    token   : str — Bearer JWT token for Authorization header

    Returns
    -------
    dict  — scan data on success
    None  — user has no scans (404)
    dict with '_error' key — any failure (network, server error)
    """
    if not user_id or user_id <= 0:
        return {"_error": "Invalid User ID."}

    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        response = requests.get(
            SCAN_ENDPOINT,
            params={"userId": user_id},   # ← Backend expects camelCase
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )


        # 404 — user exists but has no scan yet
        if response.status_code == 404:
            return None

        # Other HTTP errors
        if not response.ok:
            return {"_error": f"Server returned HTTP {response.status_code}: {response.text[:200]}"}

        body = response.json()

        # Validate response structure
        if body.get("status") != "success":
            msg = body.get("message", "Unknown API error")
            return {"_error": f"API error: {msg}"}

        data = body.get("data")
        if not data:
            return {"_error": "API returned success but no data field found."}

        # ── Derive body_fat_mass if not provided ──────────────────
        # body_fat_mass = weight × body_fat_pct / 100
        if "body_fat_mass" not in data and data.get("weight_kg") and data.get("body_fat_pct"):
            data["body_fat_mass"] = round(
                float(data["weight_kg"]) * float(data["body_fat_pct"]) / 100, 2
            )

        return data

    except requests.exceptions.ConnectionError:
        return {"_error": f"Cannot reach server at {BACKEND_HOST}. Check that you are on the same network."}
    except requests.exceptions.Timeout:
        return {"_error": f"Request timed out after {REQUEST_TIMEOUT}s. The server may be busy."}
    except requests.exceptions.JSONDecodeError:
        return {"_error": "Server returned an invalid response (not JSON)."}
    except Exception as e:
        return {"_error": f"Unexpected error: {e}"}


# ─────────────────────────────────────────────
# get_username 
# Returns None (the backend can add username to the 
# scan response if needed).
# ─────────────────────────────────────────────
def get_username(user_id: int) -> Optional[str]:
    """Placeholder — username can be added to the /api/ai/public/inbody/latest response by the backend."""
    return None
