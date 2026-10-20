"""Transparent heuristic rules for synthetic authentication events."""
from datetime import datetime, timezone
from typing import Any


def analyze_event(event: dict[str, Any]) -> dict[str, Any]:
    """Return score, severity, and evidence. This is triage guidance, not proof."""
    score = 0
    evidence: list[str] = []
    failed = int(event.get("failed_attempts", 0) or 0)

    if failed >= 10:
        score += 35
        evidence.append(f"High volume of failed attempts ({failed})")
    elif failed >= 5:
        score += 22
        evidence.append(f"Repeated failed attempts ({failed})")
    elif failed >= 3:
        score += 12
        evidence.append(f"Several failed attempts ({failed})")

    if event.get("new_device"):
        score += 18
        evidence.append("Device has not been seen for this account")

    if event.get("unusual_hour"):
        score += 12
        evidence.append("Login occurred outside the account's usual hours")

    if event.get("impossible_travel"):
        score += 35
        evidence.append("Simulated impossible-travel signal detected")

    if event.get("privileged_account"):
        score += 10
        evidence.append("Account is marked as privileged")

    score = min(score, 100)
    severity = "Critical" if score >= 80 else "High" if score >= 60 else "Medium" if score >= 35 else "Low"
    return {"risk_score": score, "severity": severity, "evidence": evidence}


def parse_timestamp(value: str) -> datetime:
    """Parse ISO timestamps consistently, treating naive values as UTC."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
