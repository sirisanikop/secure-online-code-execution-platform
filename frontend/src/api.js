// REST client (DS-UI-01). The JWT lives in sessionStorage, so it disappears when the tab closes.
const KEY = "codebox_token";

export class ApiError extends Error {
  constructor(status, code, message, retryAfter) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export const tokenStore = {
  get: () => { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set: (t) => { try { sessionStorage.setItem(KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ } },
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server. Is the back end running?");
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    const e = data?.error || {};
    if (res.status === 401 && auth && token) onUnauthorized();
    throw new ApiError(res.status, e.code || "ERROR", e.message || `Request failed (${res.status})`, res.headers.get("Retry-After"));
  }
  return data;
}

export const api = {
  register: (username, password) => request("/api/auth/register", { method: "POST", body: { username, password }, auth: false }),
  login: (username, password) => request("/api/auth/login", { method: "POST", body: { username, password }, auth: false }),
  me: () => request("/api/auth/me"),
  limits: () => request("/api/limits", { auth: false }),
  run: (code, stdin) => request("/api/executions", { method: "POST", body: { code, stdin } }),
  history: (limit = 20, offset = 0) => request(`/api/executions?limit=${limit}&offset=${offset}`),
  execution: (id) => request(`/api/executions/${id}`),
  remove: (id) => request(`/api/executions/${id}`, { method: "DELETE" }),
  auditEvents: (type) => request(`/api/admin/audit-events?limit=100${type ? `&type=${encodeURIComponent(type)}` : ""}`),
  stats: () => request("/api/admin/stats"),
};
