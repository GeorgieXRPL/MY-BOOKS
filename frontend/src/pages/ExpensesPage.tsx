import { useState, useEffect } from "react";
import { api, safeArray } from "../lib/api";

interface Expense {
  id: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  status: string;
  reimbursable: boolean;
  paidBy?: string;
  accountId?: string;
  taxAmount?: number;
  createdAt?: string;
  submittedAt?: string;
  approvedBy?: string;
}

const CATEGORIES = ["Travel", "Office Supplies", "Software", "Utilities", "Marketing", "Professional Services", "Other"];

const ExpensesPage = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    category: "Other",
    vendor: "",
    description: "",
    amount: 0,
    currency: "USD",
    date: new Date().toISOString().split("T")[0],
    reimbursable: false,
    paidBy: "",
    accountId: "",
    taxAmount: 0
  });
  const [status, setStatus] = useState("");

  // Get pending approval count
  const pendingCount = expenses.filter(e => e.status === "submitted").length;

  useEffect(() => {
    loadExpenses();
    loadAccounts();
  }, [filter]);

  const loadExpenses = async () => {
    try {
      const statusParam = filter === "all" ? "" : `&status=${filter}`;
      const res = await api.get(`/expenses?orgId=demo-org${statusParam}`);
      setExpenses(safeArray(res.data));
    } catch (e: any) {
      console.warn("Failed to load expenses:", e);
      setExpenses([]);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/ledger/accounts?orgId=demo-org");
      setAccounts(res.data.filter((a: any) => a.type === "EXPENSE"));
    } catch (e) {
      console.error(e);
    }
  };

  const createExpense = async () => {
    try {
      setStatus("Creating...");
      await api.post("/expenses", { orgId: "demo-org", ...form });
      setStatus("Expense created!");
      setShowForm(false);
      setForm({ category: "Other", vendor: "", description: "", amount: 0, currency: "USD", date: new Date().toISOString().split("T")[0], reimbursable: false, paidBy: "", accountId: "", taxAmount: 0 });
      loadExpenses();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const submitExpense = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/submit`);
      loadExpenses();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const approveExpense = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/approve`);
      loadExpenses();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const rejectExpense = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/reject`);
      loadExpenses();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="page">
      <h2>Expenses</h2>

      <div className="summary-bar">
        <div className="summary-item">
          <span className="label">Total</span>
          <span className="value">${totalExpenses.toFixed(2)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Count</span>
          <span className="value">{expenses.length}</span>
        </div>
        <div className="summary-item" style={{ background: pendingCount > 0 ? "#fff8e1" : undefined }}>
          <span className="label">Pending Approval</span>
          <span className="value" style={{ color: pendingCount > 0 ? "#f57c00" : undefined }}>
            {pendingCount} {pendingCount > 0 && "⚠️"}
          </span>
        </div>
        <div className="summary-item">
          <span className="label">Approved</span>
          <span className="value" style={{ color: "#4CAF50" }}>
            {expenses.filter((e) => e.status === "approved").length}
          </span>
        </div>
      </div>

      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Expenses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
        <button className="btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Expense"}
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Add Expense</h3>
          <div className="form-grid">
            <div className="form-row">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Vendor</label>
              <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Amount</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Account</label>
              <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">Select Account</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Tax Amount</label>
              <input type="number" value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: parseFloat(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Paid By</label>
              <input value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })} placeholder="Employee name" />
            </div>
            <div className="form-row checkbox">
              <label>
                <input type="checkbox" checked={form.reimbursable} onChange={(e) => setForm({ ...form, reimbursable: e.target.checked })} />
                Reimbursable
              </label>
            </div>
          </div>
          <button className="btn" onClick={createExpense}>Add Expense</button>
        </div>
      )}

      {status && <p className="status">{status}</p>}

      {/* Review Panel - Shows when there are pending expenses */}
      {pendingCount > 0 && (
        <div className="form-card" style={{ background: "#fff8e1", borderLeft: "4px solid #ffc107" }}>
          <h3>⚠️ {pendingCount} Expense{pendingCount > 1 ? "s" : ""} Pending Approval</h3>
          <p style={{ color: "#666", marginBottom: 16 }}>
            The following expenses have been submitted and require your review before being recorded.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {expenses.filter(e => e.status === "submitted").map(exp => (
              <div key={exp.id} style={{ 
                background: "white", 
                padding: 16, 
                borderRadius: 8, 
                border: "1px solid #e0e0e0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <strong>{exp.vendor}</strong> — {exp.category}
                  <div style={{ color: "#666", fontSize: 14 }}>
                    {exp.description}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 14 }}>
                    <span style={{ fontWeight: "bold" }}>${exp.amount.toFixed(2)} {exp.currency}</span>
                    <span style={{ marginLeft: 12, color: "#666" }}>{exp.date}</span>
                    {exp.paidBy && <span style={{ marginLeft: 12, color: "#666" }}>Paid by: {exp.paidBy}</span>}
                    {exp.reimbursable && <span className="badge" style={{ marginLeft: 8, background: "#e3f2fd" }}>Reimbursable</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button 
                    className="btn" 
                    style={{ background: "#4CAF50" }}
                    onClick={() => approveExpense(exp.id)}
                  >
                    ✓ Approve
                  </button>
                  <button 
                    className="btn secondary" 
                    style={{ background: "#f44336", color: "white" }}
                    onClick={() => rejectExpense(exp.id)}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Vendor</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp) => (
            <tr key={exp.id}>
              <td>{exp.date}</td>
              <td>{exp.category}</td>
              <td>{exp.vendor}</td>
              <td>{exp.description}</td>
              <td>${exp.amount.toFixed(2)} {exp.reimbursable && <span className="badge">R</span>}</td>
              <td><span className={`badge ${exp.status}`}>{exp.status}</span></td>
              <td>
                {exp.status === "draft" && <button className="btn small" onClick={() => submitExpense(exp.id)}>Submit</button>}
                {exp.status === "submitted" && (
                  <>
                    <button className="btn small" onClick={() => approveExpense(exp.id)}>Approve</button>
                    <button className="btn small secondary" onClick={() => rejectExpense(exp.id)}>Reject</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ExpensesPage;



