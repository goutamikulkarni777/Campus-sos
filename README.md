# Campus Emergency SOS & Alert System

A real-time safety app for college campuses. Students can trigger an SOS
with their live location in one tap, and campus security sees it appear
instantly on a live dashboard. Security can also broadcast alerts (fire,
lockdown, medical) to every connected user at once.

## How it works

- **Student view** — a single big SOS button. Pressing it grabs the
  student's live location (via the browser's Geolocation API) and sends
  it to the server.
- **Security dashboard** — lists incidents as they come in, in real time,
  over a WebSocket connection (no refreshing). Security can acknowledge
  or resolve each incident, and can also push a campus-wide broadcast
  alert to everyone.
- **Backend** — a Flask + Flask-SocketIO server exposes a REST API for
  incidents/broadcasts and pushes live updates over WebSockets.

## Tech stack

- **Backend:** Python, Flask, Flask-SocketIO (WebSockets), SQLite (local dev)
- **Frontend:** React (loaded via CDN, no build step required), Socket.IO client
- **Database:** SQLite for local development; `backend/mysql_schema.sql`
  has the equivalent MySQL schema for a production setup

## Project structure

```
campus-sos/
├── backend/
│   ├── app.py            # Flask + Socket.IO server, REST endpoints
│   ├── database.py       # SQLite schema + connection helper
│   ├── mysql_schema.sql  # MySQL schema (production reference)
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── app.jsx           # React app (student + security views)
    └── style.css
```

## Running it locally

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The server starts on `http://localhost:5000` and creates a local
`campus_sos.db` SQLite file automatically on first run.

### 2. Frontend

In a second terminal:

```bash
cd frontend
python3 -m http.server 5500
```

Open `http://localhost:5500` in your browser. Open it in two tabs to see
the real-time flow: trigger an SOS from the "Student" tab and watch it
appear instantly on the "Security Dashboard" tab.

> The frontend needs no `npm install` — React, Babel, and Socket.IO are
> loaded from a CDN, so any static file server works.

## API reference

| Method | Endpoint                        | Description                          |
|--------|----------------------------------|---------------------------------------|
| GET    | `/api/health`                   | Health check                          |
| GET    | `/api/incidents`                 | List all incidents                    |
| POST   | `/api/sos`                       | Trigger an SOS (creates an incident)  |
| PUT    | `/api/incidents/<id>/status`     | Update incident status                |
| POST   | `/api/broadcast`                 | Send a campus-wide broadcast alert    |

WebSocket events: `new_incident`, `incident_updated`, `broadcast_alert`.


