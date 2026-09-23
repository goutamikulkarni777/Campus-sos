"""
Campus Emergency SOS & Alert System — backend

REST API + WebSocket (Socket.IO) server:
- Students trigger an SOS with live location -> security dashboard gets
  notified instantly over a WebSocket.
- Security staff can broadcast alerts (fire, lockdown, medical) to every
  connected client in real time.
- Incidents are logged to the database for tracking / history.

Run:
    pip install -r requirements.txt
    python app.py
Server starts on http://localhost:5000
"""
import eventlet
eventlet.monkey_patch()

from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room

from database import get_connection, init_db

app = Flask(__name__)
app.config["SECRET_KEY"] = "dev-secret-change-me"
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

SECURITY_ROOM = "security_dashboard"


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/incidents", methods=["GET"])
def list_incidents():
    status_filter = request.args.get("status")
    conn = get_connection()
    if status_filter:
        rows = conn.execute(
            "SELECT * FROM incidents WHERE status = ? ORDER BY created_at DESC",
            (status_filter,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM incidents ORDER BY created_at DESC"
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/sos", methods=["POST"])
def trigger_sos():
    """A student triggers an SOS. Persist it and push it to security in real time."""
    data = request.get_json(force=True) or {}
    user_name = data.get("user_name", "Anonymous")
    alert_type = data.get("alert_type", "sos")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    notes = data.get("notes", "")

    conn = get_connection()
    cursor = conn.execute(
        """INSERT INTO incidents (user_name, alert_type, latitude, longitude, notes)
           VALUES (?, ?, ?, ?, ?)""",
        (user_name, alert_type, latitude, longitude, notes),
    )
    conn.commit()
    incident_id = cursor.lastrowid
    row = conn.execute(
        "SELECT * FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone()
    conn.close()

    incident = dict(row)
    # Push instantly to every connected security dashboard.
    socketio.emit("new_incident", incident, room=SECURITY_ROOM)

    return jsonify(incident), 201


@app.route("/api/incidents/<int:incident_id>/status", methods=["PUT"])
def update_incident_status(incident_id):
    """Security updates an incident's status (acknowledged / resolved)."""
    data = request.get_json(force=True) or {}
    new_status = data.get("status")
    if new_status not in ("active", "acknowledged", "resolved"):
        return jsonify({"error": "invalid status"}), 400

    conn = get_connection()
    resolved_at = datetime.utcnow().isoformat() if new_status == "resolved" else None
    conn.execute(
        "UPDATE incidents SET status = ?, resolved_at = COALESCE(?, resolved_at) WHERE id = ?",
        (new_status, resolved_at, incident_id),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone()
    conn.close()

    if row is None:
        return jsonify({"error": "not found"}), 404

    incident = dict(row)
    # Let every client (students + dashboards) know the status changed.
    socketio.emit("incident_updated", incident)
    return jsonify(incident)


@app.route("/api/broadcast", methods=["POST"])
def broadcast_alert():
    """Security broadcasts a campus-wide alert (fire, lockdown, medical, general)."""
    data = request.get_json(force=True) or {}
    alert_type = data.get("alert_type", "general")
    message = data.get("message", "")
    created_by = data.get("created_by", "Security")

    if not message:
        return jsonify({"error": "message is required"}), 400

    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO broadcasts (alert_type, message, created_by) VALUES (?, ?, ?)",
        (alert_type, message, created_by),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM broadcasts WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    conn.close()

    broadcast = dict(row)
    # Send to everyone: students and dashboards alike.
    socketio.emit("broadcast_alert", broadcast)
    return jsonify(broadcast), 201


# ---------------------------------------------------------------------------
# WebSocket events
# ---------------------------------------------------------------------------

@socketio.on("connect")
def handle_connect():
    emit("connected", {"message": "connected to campus SOS server"})


@socketio.on("join_security")
def handle_join_security(_data=None):
    """Security dashboard clients join this room to receive live SOS pushes."""
    join_room(SECURITY_ROOM)
    emit("joined_security", {"room": SECURITY_ROOM})


if __name__ == "__main__":
    init_db()
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)
