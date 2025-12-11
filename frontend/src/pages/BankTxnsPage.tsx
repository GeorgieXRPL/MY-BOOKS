import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface BankTxn {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: "debit" | "credit";
  category?: string;
  status: string;
}

const BankTxnsPage = () => {
  const [txns, setTxns] = useState<BankTxn[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({
    bankAccountId: "main-bank",
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: 0,
    currency: "USD",
    type: "debit" as "debit" | "credit"
  });
  const [csvText, setCsvText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadTxns();
    loadAccounts();
  }, [filter]);

  const loadTxns = async () => {
    try {
      const statusParam = filter === "all" ? "" : `&status=${filter}`;
      const res = await api.get(`/bank-txns?orgId=demo-org${statusParam}`);
      setTxns(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/ledger/accounts?orgId=demo-org");
      setAccounts(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const createTxn = async () => {
    try {
      await api.post("/bank-txns", { orgId: "demo-org", ...form });
      setShowForm(false);
      setForm({ bankAccountId: "main-bank", date: new Date().toISOString().split("T")[0], description: "", amount: 0, currency: "USD", type: "debit" });
      loadTxns();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const importCsv = async () => {
    try {
      const lines = csvText.trim().split("\n");
      const rows = lines.slice(1).map((line) => {
        const [date, description, amount] = line.split(",");
        return { date: date?.trim(), description: description?.trim(), amount: amount?.trim() };
      });
      await api.post("/bank-txns/import", {
        orgId: "demo-org",
        bankAccountId: "main-bank",
        currency: "USD",
        rows
      });
      setShowImport(false);
      setCsvText("");
      loadTxns();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const categorize = async (id: string, category: string, accountId: string) => {
    try {
      await api.post(`/bank-txns/${id}/categorize`, { category, accountId });
      loadTxns();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const reconcile = async (id: string) => {
    try {
      await api.post(`/bank-txns/${id}/reconcile`);
      loadTxns();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const totalDebits = txns.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const totalCredits = txns.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="page">
      <h2>Bank Transactions</h2>

      <div className="summary-bar">
        <div className="summary-item">
          <span className="label">Total Debits</span>
          <span className="value debit">-${totalDebits.toFixed(2)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Total Credits</span>
          <span className="value credit">+${totalCredits.toFixed(2)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Net</span>
          <span className="value">${(totalCredits - totalDebits).toFixed(2)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Uncategorized</span>
          <span className="value">{txns.filter((t) => t.status === "uncategorized").length}</span>
        </div>
      </div>

      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="uncategorized">Uncategorized</option>
          <option value="categorized">Categorized</option>
          <option value="reconciled">Reconciled</option>
        </select>
        <button className="btn" onClick={() => setShowForm(!showForm)}>+ Manual Entry</button>
        <button className="btn secondary" onClick={() => setShowImport(!showImport)}>Import CSV</button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Manual Entry</h3>
          <div className="form-grid">
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
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
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
                <option value="debit">Debit (Outflow)</option>
                <option value="credit">Credit (Inflow)</option>
              </select>
            </div>
          </div>
          <button className="btn" onClick={createTxn}>Add Transaction</button>
        </div>
      )}

      {showImport && (
        <div className="form-card">
          <h3>Import CSV</h3>
          <p className="hint">Format: date,description,amount (header row required)</p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="date,description,amount&#10;2024-01-15,Office Supplies,-250.00&#10;2024-01-16,Client Payment,5000.00"
            rows={8}
          />
          <button className="btn" onClick={importCsv}>Import</button>
        </div>
      )}

      {status && <p className="status">{status}</p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {txns.map((txn) => (
            <tr key={txn.id}>
              <td>{txn.date}</td>
              <td>{txn.description}</td>
              <td className={txn.type}>{txn.type === "debit" ? "-" : "+"}${txn.amount.toFixed(2)}</td>
              <td>{txn.category || "-"}</td>
              <td><span className={`badge ${txn.status}`}>{txn.status}</span></td>
              <td>
                {txn.status === "uncategorized" && (
                  <select onChange={(e) => {
                    const [cat, accId] = e.target.value.split("|");
                    if (cat && accId) categorize(txn.id, cat, accId);
                  }} defaultValue="">
                    <option value="">Categorize...</option>
                    {accounts.map((a) => <option key={a.id} value={`${a.name}|${a.id}`}>{a.name}</option>)}
                  </select>
                )}
                {txn.status === "categorized" && (
                  <button className="btn small" onClick={() => reconcile(txn.id)}>Reconcile</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BankTxnsPage;



