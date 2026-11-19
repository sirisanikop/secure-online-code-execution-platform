import { Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Icon from "./components/Icon";
import AuthPage from "./pages/AuthPage";
import EditorPage from "./pages/EditorPage";
import HistoryPage from "./pages/HistoryPage";
import AdminPage from "./pages/AdminPage";

function Shell({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="CodeBox">
          <span className="brand-mark"><Icon name="terminal" /></span>
          <span className="brand-text">CodeBox</span>
        </Link>
        <nav aria-label="Main">
          <NavLink to="/" end>Editor</NavLink>
          <NavLink to="/history">History</NavLink>
          {user.is_admin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <span className="spacer" />
        <span className="user-chip">
          <span className="avatar" aria-hidden="true">{user.username.slice(0, 1)}</span>
          <span className="user-name">{user.username}</span>
        </span>
        <button className="small" onClick={() => { logout(); nav("/login"); }}>Log out</button>
      </header>
      <main className="content">{children}</main>
      <footer className="footer">CodeBox runs every program in an isolated, time- and memory-limited sandbox.</footer>
    </>
  );
}

function Protected({ children, admin = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted center">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !user.is_admin) return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  const { user, ready } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={ready && user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={<Protected><EditorPage /></Protected>} />
      <Route path="/history" element={<Protected><HistoryPage /></Protected>} />
      <Route path="/admin" element={<Protected admin><AdminPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
