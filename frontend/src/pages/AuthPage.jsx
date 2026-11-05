import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

function validate(mode, username, password) {
  const errs = {};
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) errs.username = "3-30 characters: letters, digits or underscore";
  if (mode === "register") {
    if (password.length < 8) errs.password = "At least 8 characters";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errs.password = "Must contain a letter and a digit";
  } else if (!password) errs.password = "Enter your password";
  return errs;
}

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
      <h1>CodeBox</h1>
      <p className="muted">Write Python, run it safely in an isolated sandbox.</p>
      <form onSubmit={submit} noValidate aria-label={mode === "login" ? "Log in" : "Register"}>
        <h2>{mode === "login" ? "Log in" : "Create an account"}</h2>
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
    </main>
  );
}
