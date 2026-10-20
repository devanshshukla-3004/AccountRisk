"""AccountRisk API backed by a small local SQLite database."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from .risk import analyze_event

DATABASE_URL = os.getenv("ACCOUNTRISK_DATABASE_URL", "sqlite:///./accountrisk.db")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

app = FastAPI(title="AccountRisk API", version="1.0.0", description="Defensive authentication analytics using synthetic demo events.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ACCOUNTRISK_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_credentials=False,
    allow_methods=["GET", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type"],
)

class StatusUpdate(BaseModel):
    status: Literal["Open", "Investigating", "Resolved"]

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def seed_events() -> list[dict]:
    return [
        {"id": 1, "account": "a.chen@example.test", "event_type": "Login attempt", "timestamp": "2026-10-20T08:42:00Z", "source": "198.51.100.24", "device": "Chrome · Windows", "failed_attempts": 12, "new_device": True, "unusual_hour": False, "impossible_travel": False, "privileged_account": True, "status": "Open", "demo": True},
        {"id": 2, "account": "m.patel@example.test", "event_type": "Successful login", "timestamp": "2026-10-20T08:15:00Z", "source": "203.0.113.17", "device": "Safari · macOS", "failed_attempts": 1, "new_device": True, "unusual_hour": True, "impossible_travel": False, "privileged_account": False, "status": "Investigating", "demo": True},
        {"id": 3, "account": "s.lee@example.test", "event_type": "Login attempt", "timestamp": "2026-10-20T07:58:00Z", "source": "192.0.2.43", "device": "Firefox · Linux", "failed_attempts": 6, "new_device": False, "unusual_hour": False, "impossible_travel": False, "privileged_account": False, "status": "Open", "demo": True},
        {"id": 4, "account": "j.morgan@example.test", "event_type": "Successful login", "timestamp": "2026-10-20T07:20:00Z", "source": "198.51.100.77", "device": "Edge · Windows", "failed_attempts": 0, "new_device": False, "unusual_hour": False, "impossible_travel": True, "privileged_account": False, "status": "Open", "demo": True},
        {"id": 5, "account": "r.khan@example.test", "event_type": "Successful login", "timestamp": "2026-10-20T06:51:00Z", "source": "203.0.113.82", "device": "Chrome · Android", "failed_attempts": 0, "new_device": False, "unusual_hour": False, "impossible_travel": False, "privileged_account": False, "status": "Resolved", "demo": True},
    ]

def init_db() -> None:
    with engine.begin() as conn:
        conn.execute(text("""CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY, account TEXT NOT NULL, event_type TEXT NOT NULL,
            timestamp TEXT NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL,
            failed_attempts INTEGER NOT NULL, new_device INTEGER NOT NULL,
            unusual_hour INTEGER NOT NULL, impossible_travel INTEGER NOT NULL,
            privileged_account INTEGER NOT NULL, status TEXT NOT NULL, demo INTEGER NOT NULL
        )"""))
        conn.execute(text("""CREATE TABLE IF NOT EXISTS alerts (
            event_id INTEGER PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT NOT NULL
        )"""))
        count = conn.execute(text("SELECT COUNT(*) FROM events")).scalar_one()
        if count == 0:
            for event in seed_events():
                conn.execute(text("""INSERT INTO events
                    (id, account, event_type, timestamp, source, device, failed_attempts,
                     new_device, unusual_hour, impossible_travel, privileged_account, status, demo)
                    VALUES (:id, :account, :event_type, :timestamp, :source, :device, :failed_attempts,
                     :new_device, :unusual_hour, :impossible_travel, :privileged_account, :status, :demo)"""), event)
                conn.execute(text("INSERT OR REPLACE INTO alerts (event_id, status, updated_at) VALUES (:id, :status, :now)"),
                             {"id": event["id"], "status": event["status"], "now": utc_now()})

init_db()

def enrich(row: dict) -> dict:
    for key in ("new_device", "unusual_hour", "impossible_travel", "privileged_account", "demo"):
        row[key] = bool(row[key])
    analysis = analyze_event(row)
    row.update(analysis)
    return row

def get_events() -> list[dict]:
    with engine.connect() as conn:
        rows = conn.execute(text("""SELECT e.*, COALESCE(a.status, e.status) AS current_status
            FROM events e LEFT JOIN alerts a ON a.event_id=e.id ORDER BY e.timestamp DESC""")).mappings().all()
    result = []
    for item in rows:
        row = dict(item)
        row["status"] = row.pop("current_status")
        result.append(enrich(row))
    return result

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AccountRisk API", "data_mode": "synthetic_demo"}

@app.get("/api/events")
def events(q: str = Query(default="", max_length=120), status: str = "All"):
    rows = get_events()
    if q:
        needle = q.casefold()
        rows = [r for r in rows if needle in r["account"].casefold() or needle in r["device"].casefold() or needle in r["source"]]
    if status != "All":
        rows = [r for r in rows if r["status"] == status]
    return {"items": rows, "total": len(rows), "data_mode": "synthetic_demo"}

@app.get("/api/accounts")
def accounts():
    grouped: dict[str, list[dict]] = {}
    for row in get_events():
        grouped.setdefault(row["account"], []).append(row)
    items = []
    for account, rows in grouped.items():
        highest = max(rows, key=lambda r: r["risk_score"])
        items.append({"account": account, "risk_score": highest["risk_score"], "severity": highest["severity"], "events": len(rows), "open_alerts": sum(r["status"] != "Resolved" and r["risk_score"] >= 35 for r in rows)})
    return {"items": sorted(items, key=lambda x: x["risk_score"], reverse=True)}

@app.get("/api/alerts")
def alerts(status: str = "All"):
    rows = [r for r in get_events() if r["risk_score"] >= 12]
    if status != "All":
        rows = [r for r in rows if r["status"] == status]
    return {"items": rows, "total": len(rows)}

@app.get("/api/summary")
def summary():
    rows = get_events()
    active = [r for r in rows if r["status"] != "Resolved"]
    return {
        "accounts_monitored": len(set(r["account"] for r in rows)),
        "events_analyzed": len(rows),
        "high_risk_accounts": len(set(r["account"] for r in active if r["risk_score"] >= 60)),
        "open_alerts": sum(r["status"] != "Resolved" and r["risk_score"] >= 35 for r in rows),
        "resolved": sum(r["status"] == "Resolved" for r in rows),
        "average_risk": round(sum(r["risk_score"] for r in rows) / max(len(rows), 1), 1),
        "data_mode": "synthetic_demo",
    }

@app.patch("/api/alerts/{event_id}/status")
def update_status(event_id: int, payload: StatusUpdate):
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT id FROM events WHERE id=:id"), {"id": event_id}).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Event not found")
        conn.execute(text("INSERT OR REPLACE INTO alerts (event_id, status, updated_at) VALUES (:id, :status, :now)"),
                     {"id": event_id, "status": payload.status, "now": utc_now()})
    updated = next((r for r in get_events() if r["id"] == event_id), None)
    return {"item": updated, "message": "Investigation status updated"}
