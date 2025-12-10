import { NavLink, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import JournalsPage from "./pages/JournalsPage";
import IngestionPage from "./pages/IngestionPage";
import ReportsPage from "./pages/ReportsPage";
import ReconClosePage from "./pages/ReconClosePage";
import InvoicesPage from "./pages/InvoicesPage";
import ExpensesPage from "./pages/ExpensesPage";
import PayrollPage from "./pages/PayrollPage";
import BankTxnsPage from "./pages/BankTxnsPage";
import CryptoPage from "./pages/CryptoPage";
import AssetsPage from "./pages/AssetsPage";
import CalculationsPage from "./pages/CalculationsPage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import TeamPage from "./pages/TeamPage";
import { useAuthStore } from "./store/auth";
import { useEffect, useState } from "react";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Don't redirect on auth page
  useEffect(() => {
    if (!user && location.pathname !== "/auth") {
      navigate("/auth");
    }
  }, [user, navigate, location.pathname]);

  // If on auth page, render without sidebar
  if (location.pathname === "/auth") {
    return <>{children}</>;
  }

  // If not logged in and not on auth page, show nothing (will redirect)
  if (!user) {
    return null;
  }

  const isAdmin = user.roles.includes("admin");

  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>{collapsed ? "RA" : "Reporting App"}</h1>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "→" : "←"}
          </button>
        </div>
        
        {!collapsed && (
          <div className="user-info">
            <div className="user-avatar">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user.name || user.email.split("@")[0]}</span>
              <span className="user-role">{user.roles[0]}</span>
            </div>
          </div>
        )}

        <nav className="nav">
          <div className="nav-section">
            <span className="nav-label">{!collapsed && "Main"}</span>
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "📊" : "📊 Dashboard"}
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-label">{!collapsed && "Data Entry"}</span>
            <NavLink to="/invoices" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "📄" : "📄 Invoices"}
            </NavLink>
            <NavLink to="/expenses" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "💸" : "💸 Expenses"}
            </NavLink>
            <NavLink to="/payroll" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "👥" : "👥 Payroll"}
            </NavLink>
            <NavLink to="/bank-txns" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "🏦" : "🏦 Bank Txns"}
            </NavLink>
            <NavLink to="/crypto" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "🪙" : "🪙 Crypto"}
            </NavLink>
            <NavLink to="/journals" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "📒" : "📒 Journals"}
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-label">{!collapsed && "Assets & Calcs"}</span>
            <NavLink to="/assets" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "🏢" : "🏢 Assets"}
            </NavLink>
            <NavLink to="/calculations" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "🧮" : "🧮 Calculations"}
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-label">{!collapsed && "Reports"}</span>
            <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "📈" : "📈 Reports"}
            </NavLink>
            <NavLink to="/recon" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "✓" : "✓ Recon/Close"}
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-label">{!collapsed && "System"}</span>
            <NavLink to="/ingestion" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "⬇️" : "⬇️ Ingestion"}
            </NavLink>
            {isAdmin && (
              <NavLink to="/team" className={({ isActive }) => (isActive ? "active" : "")}>
                {collapsed ? "👥" : "👥 Team"}
              </NavLink>
            )}
            <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
              {collapsed ? "⚙️" : "⚙️ Settings"}
            </NavLink>
          </div>

          <button className="btn secondary logout-btn" onClick={logout}>
            {collapsed ? "⏏" : "Log out"}
          </button>
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
};

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/bank-txns" element={<BankTxnsPage />} />
        <Route path="/crypto" element={<CryptoPage />} />
        <Route path="/journals" element={<JournalsPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/calculations" element={<CalculationsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/recon" element={<ReconClosePage />} />
        <Route path="/ingestion" element={<IngestionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </Layout>
  );
};

export default App;
