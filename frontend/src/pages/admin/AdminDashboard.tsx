import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";

interface SystemHealth {
  uptime: number;
  uptimeFormatted: string;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  nodeVersion: string;
}

interface MetricsSummary {
  health: SystemHealth;
  requests: {
    total: number;
    last24h: number;
    lastHour: number;
    averageResponseTime: number;
    errorRate: number;
    byStatus: Record<string, number>;
    slowestEndpoints: Array<{ path: string; avgDuration: number; count: number }>;
  };
  errors: {
    total: number;
    last24h: number;
    recent: Array<{ path: string; error: string; timestamp: string }>;
  };
}

interface DbStats {
  accounts: number;
  journals: number;
  invoices: number;
  expenses: number;
  employees: number;
  wallets: number;
  cryptoTransactions: number;
  bankTransactions: number;
}

const AdminDashboard = () => {
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [featureFlags, setFeatureFlags] = useState<Record<string, { enabled: boolean; description: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, dbRes, flagsRes] = await Promise.all([
        api.get("/admin/metrics"),
        api.get("/admin/db/stats"),
        api.get("/admin/feature-flags")
      ]);
      setMetrics(metricsRes.data);
      setDbStats(dbRes.data);
      setFeatureFlags(flagsRes.data);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (flag: string, enabled: boolean) => {
    try {
      await api.patch(`/admin/feature-flags/${flag}`, { enabled });
      setFeatureFlags(prev => ({
        ...prev,
        [flag]: { ...prev[flag], enabled }
      }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const isAdmin = user?.roles?.includes("admin");

  if (!isAdmin) {
    return (
      <div className="page">
        <h2>Access Denied</h2>
        <p>You need admin privileges to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <h2>🔧 Admin Dashboard</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h2>🔧 Admin Dashboard</h2>
        <p className="error">Error: {error}</p>
        <button className="btn" onClick={loadData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>🔧 Admin Dashboard</h2>
      <p className="muted">System monitoring and administration</p>

      {/* System Health */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3>System Health</h3>
        {metrics && (
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <div className="stat-card">
              <div className="stat-value">{metrics.health.uptimeFormatted}</div>
              <div className="stat-label">Uptime</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{metrics.health.memoryUsage.heapUsed}MB</div>
              <div className="stat-label">Memory Used</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{metrics.health.nodeVersion}</div>
              <div className="stat-label">Node Version</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{metrics.requests.lastHour}</div>
              <div className="stat-label">Requests/Hour</div>
            </div>
          </div>
        )}
      </div>

      {/* Request Metrics */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3>Request Metrics (24h)</h3>
        {metrics && (
          <>
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-value">{metrics.requests.last24h}</div>
                <div className="stat-label">Total Requests</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{metrics.requests.averageResponseTime}ms</div>
                <div className="stat-label">Avg Response Time</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: metrics.requests.errorRate > 5 ? "var(--danger)" : "inherit" }}>
                  {metrics.requests.errorRate}%
                </div>
                <div className="stat-label">Error Rate</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{metrics.errors.last24h}</div>
                <div className="stat-label">Errors</div>
              </div>
            </div>

            {/* Status breakdown */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {Object.entries(metrics.requests.byStatus).map(([status, count]) => (
                <span 
                  key={status} 
                  className="badge"
                  style={{ 
                    background: status === "2xx" ? "var(--success)" : 
                               status === "4xx" ? "var(--warning)" :
                               status === "5xx" ? "var(--danger)" : "var(--muted)"
                  }}
                >
                  {status}: {count}
                </span>
              ))}
            </div>

            {/* Slowest endpoints */}
            {metrics.requests.slowestEndpoints.length > 0 && (
              <>
                <h4>Slowest Endpoints</h4>
                <table style={{ width: "100%", fontSize: "0.9em" }}>
                  <thead>
                    <tr><th>Endpoint</th><th>Avg Time</th><th>Requests</th></tr>
                  </thead>
                  <tbody>
                    {metrics.requests.slowestEndpoints.slice(0, 5).map((ep, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "monospace" }}>{ep.path}</td>
                        <td>{ep.avgDuration}ms</td>
                        <td>{ep.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>

      {/* Database Stats */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3>Database Statistics</h3>
        {dbStats && (
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <div className="stat-card">
              <div className="stat-value">{dbStats.accounts}</div>
              <div className="stat-label">Accounts</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dbStats.journals}</div>
              <div className="stat-label">Journals</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dbStats.invoices}</div>
              <div className="stat-label">Invoices</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dbStats.expenses}</div>
              <div className="stat-label">Expenses</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dbStats.employees}</div>
              <div className="stat-label">Employees</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dbStats.wallets}</div>
              <div className="stat-label">Wallets</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dbStats.cryptoTransactions}</div>
              <div className="stat-label">Crypto TXs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dbStats.bankTransactions}</div>
              <div className="stat-label">Bank TXs</div>
            </div>
          </div>
        )}
      </div>

      {/* Feature Flags */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3>Feature Flags</h3>
        <table style={{ width: "100%" }}>
          <thead>
            <tr><th>Feature</th><th>Description</th><th>Status</th></tr>
          </thead>
          <tbody>
            {Object.entries(featureFlags).map(([flag, data]) => (
              <tr key={flag}>
                <td style={{ fontFamily: "monospace" }}>{flag}</td>
                <td className="muted">{data.description}</td>
                <td>
                  <button
                    className={`btn ${data.enabled ? "success" : "secondary"}`}
                    onClick={() => toggleFeature(flag, !data.enabled)}
                    style={{ minWidth: 80 }}
                  >
                    {data.enabled ? "Enabled" : "Disabled"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Errors */}
      {metrics && metrics.errors.recent.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>Recent Errors</h3>
          <table style={{ width: "100%", fontSize: "0.85em" }}>
            <thead>
              <tr><th>Time</th><th>Path</th><th>Error</th></tr>
            </thead>
            <tbody>
              {metrics.errors.recent.slice(0, 10).map((err, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ fontFamily: "monospace" }}>{err.path}</td>
                  <td className="muted">{err.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Refresh button */}
      <div style={{ marginTop: 20 }}>
        <button className="btn secondary" onClick={loadData}>
          ↻ Refresh Data
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
