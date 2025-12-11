import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Summary {
  invoices?: { receivable: number; payable: number };
  expenses?: { total: number; pending: number };
  ratios?: { healthScore: number };
  treasury?: { crypto: number; stable: number };
}

const DashboardPage = () => {
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [invoicesRes, expensesRes, ratiosRes, treasuryRes] = await Promise.allSettled([
        api.get("/invoices?orgId=demo-org"),
        api.get("/expenses?orgId=demo-org"),
        api.get("/calc/ratios/dashboard?orgId=demo-org"),
        api.get("/reports/treasury?orgId=demo-org")
      ]);

      const newSummary: Summary = {};

      if (invoicesRes.status === "fulfilled") {
        const invoices = invoicesRes.value.data;
        newSummary.invoices = {
          receivable: invoices.filter((i: any) => i.type === "receivable" && i.status !== "paid").reduce((s: number, i: any) => s + i.total, 0),
          payable: invoices.filter((i: any) => i.type === "payable" && i.status !== "paid").reduce((s: number, i: any) => s + i.total, 0)
        };
      }

      if (expensesRes.status === "fulfilled") {
        const expenses = expensesRes.value.data;
        newSummary.expenses = {
          total: expenses.reduce((s: number, e: any) => s + e.amount, 0),
          pending: expenses.filter((e: any) => e.status === "submitted").length
        };
      }

      if (ratiosRes.status === "fulfilled") {
        newSummary.ratios = { healthScore: ratiosRes.value.data.summary?.healthScore || 0 };
      }

      if (treasuryRes.status === "fulfilled") {
        const t = treasuryRes.value.data;
        newSummary.treasury = {
          crypto: t.crypto?.total || 0,
          stable: t.stable?.total || 0
        };
      }

      setSummary(newSummary);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) return <div className="page"><p>Loading dashboard...</p></div>;

  return (
    <div className="page dashboard">
      <h2>Dashboard</h2>

      <div className="dashboard-grid">
        <div className="card">
          <h3>Accounts Receivable</h3>
          <p className="big-number">${(summary.invoices?.receivable || 0).toLocaleString()}</p>
          <span className="label">Outstanding</span>
        </div>

        <div className="card">
          <h3>Accounts Payable</h3>
          <p className="big-number">${(summary.invoices?.payable || 0).toLocaleString()}</p>
          <span className="label">Outstanding</span>
        </div>

        <div className="card">
          <h3>Expenses</h3>
          <p className="big-number">${(summary.expenses?.total || 0).toLocaleString()}</p>
          <span className="label">{summary.expenses?.pending || 0} pending approval</span>
        </div>

        <div className="card">
          <h3>Financial Health</h3>
          <p className="big-number">{summary.ratios?.healthScore || 0}%</p>
          <span className="label">Based on key ratios</span>
        </div>

        <div className="card">
          <h3>Crypto Holdings</h3>
          <p className="big-number">${(summary.treasury?.crypto || 0).toLocaleString()}</p>
          <span className="label">USD value</span>
        </div>

        <div className="card">
          <h3>Stablecoin Holdings</h3>
          <p className="big-number">${(summary.treasury?.stable || 0).toLocaleString()}</p>
          <span className="label">USD value</span>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <a href="/invoices" className="btn">Create Invoice</a>
          <a href="/expenses" className="btn">Add Expense</a>
          <a href="/journals" className="btn">New Journal</a>
          <a href="/reports" className="btn">View Reports</a>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;



