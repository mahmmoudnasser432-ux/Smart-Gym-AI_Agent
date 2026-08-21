import re

# ============================================================
# SAFETY GUARD — Only blocks genuinely harmful content.
# Topic filtering (fitness scope) is handled by the LLM itself.
# Keyword matching is a bad tool for topic scope because:
#   - it fails on typos ("trainig", "inirjy")
#   - it blocks greetings and context-setting messages
#   - the LLM prompt already instructs the model to refuse off-topic questions
# ============================================================

BLOCKED_PATTERNS = {
    "hack", "hacking", "kill", "murder", "weapon", "bomb",
    "drug", "steal", "attack", "illegal", "violence", "terrorist",
    "suicide", "self-harm", "overdose",
}


def is_blocked(text: str) -> bool:
    """Return True only if the message contains genuinely dangerous content."""
    text = text.lower()
    for word in BLOCKED_PATTERNS:
        if re.search(r'\b' + re.escape(word) + r'\b', text):
            return True
    return False


def guard_question(question: str):
    """
    Safety gate: only block harmful content.
    The LLM handles topic scope (fitness only) via its system prompt.
    """
    if is_blocked(question):
        return False, "⚠️ I can't help with that. I'm your AI Gym Coach and I only assist with fitness and nutrition."

    # Allow everything else — let the LLM decide if it's fitness-related
    return True, ""