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
}

const CATEGORIES = ["Travel", "Office Supplies", "Software", "Utilities", "Marketing", "Professional Services", "Other"];

const ExpensesPage = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
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
        <div className="summary-item">
          <span className="label">Pending Approval</span>
          <span className="value">{expenses.filter((e) => e.status === "submitted").length}</span>
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



