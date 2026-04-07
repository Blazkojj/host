import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import BotsPage from "./pages/BotsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ServersPage from "./pages/ServersPage.jsx";

function FullscreenMessage({ children }) {
  return <div className="fullscreen-shell">{children}</div>;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullscreenMessage>Loading panel...</FullscreenMessage>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullscreenMessage>Loading panel...</FullscreenMessage>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        }
      />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/bots" element={<BotsPage />} />
        <Route path="/servers" element={<ServersPage />} />
        <Route
          path="/admin"
          element={
            <AdminOnly>
              <AdminPage />
            </AdminOnly>
          }
        />
      </Route>
    </Routes>
  );
}
