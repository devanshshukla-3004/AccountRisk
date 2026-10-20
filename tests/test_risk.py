from backend.app.risk import analyze_event


def test_clean_login_is_low_risk():
    result = analyze_event({"failed_attempts": 0})
    assert result["risk_score"] == 0
    assert result["severity"] == "Low"
    assert result["evidence"] == []


def test_multiple_signals_are_explained():
    result = analyze_event({
        "failed_attempts": 12,
        "new_device": True,
        "impossible_travel": True,
        "privileged_account": True,
    })
    assert result["risk_score"] == 98
    assert result["severity"] == "Critical"
    assert len(result["evidence"]) == 4


def test_score_is_capped_at_100():
    result = analyze_event({
        "failed_attempts": 100,
        "new_device": True,
        "unusual_hour": True,
        "impossible_travel": True,
        "privileged_account": True,
    })
    assert result["risk_score"] == 100
