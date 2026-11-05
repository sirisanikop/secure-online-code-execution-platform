import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
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
        <strong>CodeBox</strong>
        <nav aria-label="Main">
          <NavLink to="/" end>Editor</NavLink>
          <NavLink to="/history">History</NavLink>
          {user.is_admin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <span className="spacer" />
        <span className="muted">{user.username}</span>
        <button onClick={() => { logout(); nav("/login"); }}>Log out</button>
      </header>
      <main className="content">{children}</main>
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
