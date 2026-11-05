import { useEffect, useState } from "react";
import { api } from "../api";

const TYPES = ["", "LOGIN_FAILED", "LOGIN_THROTTLED", "BLOCKED_CODE", "TIMEOUT", "MEMORY_LIMIT", "OUTPUT_LIMIT", "RATE_LIMITED", "ADMIN_ACCESS"];

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [type, setType] = useState("");
  const [events, setEvents] = useState({ items: [], total: 0 });
  const [error, setError] = useState("");

  useEffect(() => { api.stats().then(setStats).catch((e) => setError(e.message)); }, []);
  useEffect(() => { api.auditEvents(type).then(setEvents).catch((e) => setError(e.message)); }, [type]);

  return (
    <div>
      <h2>Administration</h2>
      {error && <div className="form-error" role="alert">{error}</div>}
      {stats && (
        <div className="stats">
          <div><b>{stats.total_runs}</b><span>total runs</span></div>
          <div><b>{stats.total_users}</b><span>users</span></div>
          <div><b>{stats.active_users_24h}</b><span>active (24 h)</span></div>
          <div><b>{stats.avg_runtime_ms}</b><span>avg ms</span></div>
          {Object.entries(stats.runs_by_status).map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
        </div>
      )}
      <h3>Audit events ({events.total})</h3>
      <label htmlFor="etype">Filter by type </label>
      <select id="etype" value={type} onChange={(e) => setType(e.target.value)}>
        {TYPES.map((t) => <option key={t} value={t}>{t || "All"}</option>)}
      </select>
      <table>
        <thead><tr><th>Time</th><th>Type</th><th>User</th><th>IP</th><th>Detail</th></tr></thead>
        <tbody>
          {events.items.map((e) => (
            <tr key={e.id}><td>{new Date(e.created_at).toLocaleString()}</td><td>{e.event_type}</td><td>{e.user_id ?? "-"}</td>
              <td>{e.ip_address}</td><td>{e.detail}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
