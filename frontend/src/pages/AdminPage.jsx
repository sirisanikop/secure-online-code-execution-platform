import { useEffect, useState } from "react";
import { api } from "../api";
import Icon from "../components/Icon";
import { formatIST } from "../time";

const TYPES = ["", "LOGIN_FAILED", "LOGIN_THROTTLED", "BLOCKED_CODE", "TIMEOUT", "MEMORY_LIMIT", "OUTPUT_LIMIT", "RATE_LIMITED", "ADMIN_ACCESS"];
const TONE = { COMPLETED: "ok", RUNTIME_ERROR: "err", BLOCKED: "err", INTERNAL_ERROR: "err", TIMEOUT: "warn", MEMORY_LIMIT: "warn", OUTPUT_LIMIT: "warn" };

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [type, setType] = useState("");
  const [events, setEvents] = useState({ items: [], total: 0 });
  const [error, setError] = useState("");

  useEffect(() => { api.stats().then(setStats).catch((e) => setError(e.message)); }, []);
  useEffect(() => { api.auditEvents(type).then(setEvents).catch((e) => setError(e.message)); }, [type]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Administration</h2>
          <p>Platform usage and security audit trail.</p>
        </div>
      </div>
      {error && <div className="form-error" role="alert"><Icon name="alert" />{error}</div>}
      {stats && (
        <div className="stats">
          <div><b>{stats.total_runs}</b><span>total runs</span></div>
          <div><b>{stats.total_users}</b><span>users</span></div>
          <div><b>{stats.active_users_24h}</b><span>active (24 h)</span></div>
          <div><b>{stats.avg_runtime_ms}</b><span>avg ms</span></div>
          {Object.entries(stats.runs_by_status).map(([k, v]) => (
            <div key={k} className={`by-status ${TONE[k] || ""}`}><b>{v}</b><span>{k}</span></div>
          ))}
        </div>
      )}
      <div className="section-title"><h3>Audit events</h3><span className="count">{events.total} total</span></div>
      <div className="filter">
        <label htmlFor="etype">Filter by type</label>
        <select id="etype" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t || "All"}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Type</th><th>User</th><th>IP</th><th>Detail</th></tr></thead>
          <tbody>
            {events.items.map((e) => (
              <tr key={e.id}><td className="when">{formatIST(e.created_at)}</td><td>{e.event_type}</td><td>{e.user_id ?? "-"}</td>
                <td className="num">{e.ip_address}</td><td>{e.detail}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
