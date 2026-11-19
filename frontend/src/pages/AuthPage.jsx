import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import Icon from "../components/Icon";

function validate(mode, username, password) {
  const errs = {};
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) errs.username = "3-30 characters: letters, digits or underscore";
  if (mode === "register") {
    if (password.length < 8) errs.password = "At least 8 characters";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errs.password = "Must contain a letter and a digit";
  } else if (!password) errs.password = "Enter your password";
  return errs;
}

const FEATURES = [
  ["shield", "Isolated sandbox", "Network, file and process access are blocked for submitted code."],
  ["gauge", "Hard resource limits", "Time, memory and output are capped, so runaway code is stopped cleanly."],
  ["clock", "Your run history", "Every execution is saved to your account so you can review or re-run it."],
];

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setFormError("");
    const errs = validate(mode, username, password);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (mode === "register") await api.register(username, password);
      await login(username, password);
      nav("/");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-brand">
        <span className="brand"><span className="brand-mark"><Icon name="terminal" /></span>CodeBox</span>
        <div>
          <h1>Run Python safely, in your browser.</h1>
          <p className="lead">Write code, run it in a locked-down sandbox and see the result in seconds.</p>
        </div>
        <ul className="features">
          {FEATURES.map(([icon, title, text]) => (
            <li key={title}>
              <span className="fi"><Icon name={icon} /></span>
              <div><strong>{title}</strong><span>{text}</span></div>
            </li>
          ))}
        </ul>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="brand"><span className="brand-mark"><Icon name="terminal" /></span>CodeBox</span>
          <form onSubmit={submit} noValidate aria-label={mode === "login" ? "Log in" : "Register"}>
            <h2>{mode === "login" ? "Log in" : "Create an account"}</h2>
            <p className="sub">{mode === "login" ? "Welcome back. Sign in to continue." : "It takes a few seconds to get started."}</p>
            <label htmlFor="username">Username</label>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
                   aria-invalid={!!errors.username} aria-describedby="username-err" />
            <div id="username-err" className="field-error" role="alert">{errors.username}</div>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                   autoComplete={mode === "login" ? "current-password" : "new-password"}
                   aria-invalid={!!errors.password} aria-describedby="password-err" />
            <div id="password-err" className="field-error" role="alert">{errors.password}</div>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <button type="submit" className="primary" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Log in" : "Register"}</button>
            <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErrors({}); setFormError(""); }}>
              {mode === "login" ? "No account? Register" : "Have an account? Log in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
