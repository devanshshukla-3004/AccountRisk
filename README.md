# AccountRisk — Identity & Account Risk Engine

**Day 17/100 · 100 Days of Cybersecurity Projects**

AccountRisk is a defensive authentication analytics prototype that analyzes synthetic login events, detects suspicious patterns, calculates transparent account risk scores, and supports alert investigation.

> **Safety & scope:** The initial version uses synthetic demo events only. It does not collect credentials, connect to identity providers, or access real accounts. Detection results are heuristics for triage—not proof of compromise.

## Features

- Explainable risk scoring based on failed logins, new devices, unusual hours, and simulated impossible travel.
- Rule-based detections with evidence attached to each alert.
- Account-level risk summaries and event timelines.
- Alert lifecycle: Open → Investigating → Resolved.
- FastAPI backend, SQLite persistence, React + TypeScript dashboard.
- Unit/API tests and GitHub Actions CI.

## Architecture

```text
frontend/     React + TypeScript + Vite dashboard
backend/      FastAPI REST API and SQLite persistence
tests/        Pytest detection and API tests
```

## Run locally

### 1. Backend (Python 3.11+)

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# If PowerShell blocks activation, use: .venv\Scripts\python.exe -m pip install -r requirements.txt
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API: http://127.0.0.1:8000  
Interactive API docs: http://127.0.0.1:8000/docs

### 2. Frontend (Node.js 20+)

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

If PowerShell blocks npm.ps1, run `npm.cmd install` and `npm.cmd run dev`.

### 3. Tests

From the repository root:

```bash
python -m pip install -r backend/requirements.txt
python -m pytest -q
```

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API status |
| GET | `/api/summary` | Dashboard metrics |
| GET | `/api/events` | Authentication events |
| GET | `/api/accounts` | Account risk summaries |
| GET | `/api/alerts` | Detection alerts |
| PATCH | `/api/alerts/{alert_id}/status` | Update investigation status |

The app seeds clearly labelled synthetic events on first startup. Risk scores and rules are intentionally simple and inspectable; they should not be treated as a production identity-security control.

## Tech stack

Python · FastAPI · SQLAlchemy · SQLite · React · TypeScript · Vite · Pytest · GitHub Actions

## Roadmap

- [x] Synthetic authentication event model
- [x] Rule-based detection and explainable risk score
- [x] API and investigation workflow
- [x] Dashboard and filters
- [ ] Real identity-provider integrations (with explicit authorization)
- [ ] Calibrated baselines and evaluation against labelled data

## Author

Devansh Shukla · [GitHub](https://github.com/devanshshukla-3004)
