const { useState, useEffect, useRef, useCallback } = React;

const API_BASE = "http://localhost:5000";

function useSocket(onEvents) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API_BASE);
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    Object.entries(onEvents || {}).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connected, socket: socketRef.current };
}

function ConnectionPill({ connected }) {
  return (
    <div className="connection-pill">
      <span className={`dot ${connected ? "on" : "off"}`} />
      {connected ? "Live connection to security" : "Connecting..."}
    </div>
  );
}

function BroadcastBanner({ broadcast }) {
  if (!broadcast) return null;
  return (
    <div className="broadcast-banner">
      <strong>{broadcast.alert_type}</strong> alert from {broadcast.created_by || "Security"}: {broadcast.message}
    </div>
  );
}

function StudentView() {
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [latestBroadcast, setLatestBroadcast] = useState(null);

  const { connected } = useSocket({
    broadcast_alert: (data) => setLatestBroadcast(data),
  });

  const getLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 4000 }
      );
    });

  const triggerSOS = async () => {
    setSending(true);
    setStatusMsg(null);
    try {
      const location = await getLocation();
      const res = await fetch(`${API_BASE}/api/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: name || "Anonymous Student",
          alert_type: "sos",
          latitude: location ? location.latitude : null,
          longitude: location ? location.longitude : null,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatusMsg({ type: "sent", text: "Alert sent — security has been notified with your location." });
    } catch (err) {
      setStatusMsg({ type: "error", text: "Could not reach the server. Check that the backend is running." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <ConnectionPill connected={connected} />
      <BroadcastBanner broadcast={latestBroadcast} />
      <div className="sos-card">
        <h1>Press if you need help</h1>
        <p className="sub">Your live location is sent to campus security the moment you press this.</p>
        <button className="sos-button" onClick={triggerSOS} disabled={sending}>
          {sending ? "Sending..." : "SOS"}
        </button>
        <div className="field-row">
          <label htmlFor="name">Your name (optional)</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goutami K" />
        </div>
        {statusMsg && (
          <div className={`status-banner ${statusMsg.type}`}>{statusMsg.text}</div>
        )}
      </div>
    </div>
  );
}

function IncidentCard({ incident, onUpdateStatus }) {
  const created = new Date(incident.created_at + "Z").toLocaleTimeString();
  const locationText =
    incident.latitude && incident.longitude
      ? `${Number(incident.latitude).toFixed(4)}, ${Number(incident.longitude).toFixed(4)}`
      : "Location unavailable";

  return (
    <div className={`incident-card ${incident.status}`}>
      <div className="incident-info">
        <div className="type-tag">{incident.alert_type}</div>
        <div className="who">{incident.user_name}</div>
        <div className="meta">{created} · {locationText}</div>
      </div>
      <div className="incident-actions">
        {incident.status === "active" && (
          <button onClick={() => onUpdateStatus(incident.id, "acknowledged")}>Acknowledge</button>
        )}
        {incident.status !== "resolved" && (
          <button className="primary" onClick={() => onUpdateStatus(incident.id, "resolved")}>Resolve</button>
        )}
      </div>
    </div>
  );
}

function SecurityView() {
  const [incidents, setIncidents] = useState([]);
  const [broadcastType, setBroadcastType] = useState("fire");
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const upsertIncident = useCallback((incident) => {
    setIncidents((prev) => {
      const exists = prev.some((i) => i.id === incident.id);
      if (exists) return prev.map((i) => (i.id === incident.id ? incident : i));
      return [incident, ...prev];
    });
  }, []);

  const { connected, socket } = useSocket({
    new_incident: upsertIncident,
    incident_updated: upsertIncident,
  });

  useEffect(() => {
    if (socket) socket.emit("join_security");
  }, [socket]);

  useEffect(() => {
    fetch(`${API_BASE}/api/incidents`)
      .then((r) => r.json())
      .then(setIncidents)
      .catch(() => {});
  }, []);

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      upsertIncident(data);
    } catch (err) {
      /* noop for demo */
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    await fetch(`${API_BASE}/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert_type: broadcastType, message: broadcastMsg, created_by: "Security Desk" }),
    });
    setBroadcastMsg("");
  };

  const activeCount = incidents.filter((i) => i.status !== "resolved").length;

  return (
    <div>
      <ConnectionPill connected={connected} />

      <div className="broadcast-form">
        <h3>Broadcast a campus-wide alert</h3>
        <div className="row">
          <select value={broadcastType} onChange={(e) => setBroadcastType(e.target.value)}>
            <option value="fire">Fire</option>
            <option value="lockdown">Lockdown</option>
            <option value="medical">Medical</option>
            <option value="general">General</option>
          </select>
          <input
            placeholder="e.g. Evacuate Block B immediately"
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
          />
          <button onClick={sendBroadcast}>Send</button>
        </div>
      </div>

      <div className="section-label">{activeCount} open incident{activeCount === 1 ? "" : "s"}</div>
      <div className="dash-grid">
        {incidents.length === 0 && <div className="empty-state">No incidents yet. Waiting for SOS alerts...</div>}
        {incidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} onUpdateStatus={updateStatus} />
        ))}
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("student");

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand">Campus<span>SOS</span></div>
        <div className="tab-switch">
          <button className={tab === "student" ? "active" : ""} onClick={() => setTab("student")}>Student</button>
          <button className={tab === "security" ? "active" : ""} onClick={() => setTab("security")}>Security Dashboard</button>
        </div>
      </div>
      {tab === "student" ? <StudentView /> : <SecurityView />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
