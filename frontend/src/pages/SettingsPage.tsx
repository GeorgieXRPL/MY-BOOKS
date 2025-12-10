import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  type: string;
  jurisdiction?: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  isActive: boolean;
}

const SettingsPage = () => {
  const [tab, setTab] = useState<"tax" | "coa" | "org">("org");
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [taxForm, setTaxForm] = useState({
    name: "",
    rate: 10,
    type: "sales",
    jurisdiction: "",
    isDefault: false,
    isActive: true,
    orgId: "demo-org"
  });
  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    type: "ASSET",
    currency: "USD",
    isActive: true,
    orgId: "demo-org"
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadTaxRates();
    loadAccounts();
  }, []);

  const loadTaxRates = async () => {
    try {
      const res = await api.get("/calc/tax/rates?orgId=demo-org");
      setTaxRates(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/ledger/accounts?orgId=demo-org");
      setAccounts(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const createTaxRate = async () => {
    try {
      await api.post("/calc/tax/rates", taxForm);
      setShowTaxForm(false);
      setTaxForm({ name: "", rate: 10, type: "sales", jurisdiction: "", isDefault: false, isActive: true, orgId: "demo-org" });
      loadTaxRates();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const createAccount = async () => {
    try {
      await api.post("/ledger/accounts", accountForm);
      setShowAccountForm(false);
      setAccountForm({ code: "", name: "", type: "ASSET", currency: "USD", isActive: true, orgId: "demo-org" });
      loadAccounts();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  return (
    <div className="page">
      <h2>Settings</h2>

      <div className="tabs">
        <button className={tab === "org" ? "active" : ""} onClick={() => setTab("org")}>Organization</button>
        <button className={tab === "coa" ? "active" : ""} onClick={() => setTab("coa")}>Chart of Accounts</button>
        <button className={tab === "tax" ? "active" : ""} onClick={() => setTab("tax")}>Tax Rates</button>
      </div>

      {status && <p className="status">{status}</p>}

      {tab === "org" && (
        <div className="settings-section">
          <div className="form-card">
            <h3>Organization Settings</h3>
            <div className="form-grid">
              <div className="form-row">
                <label>Organization ID</label>
                <input value="demo-org" disabled />
              </div>
              <div className="form-row">
                <label>Base Currency</label>
                <input value="USD" disabled />
              </div>
              <div className="form-row">
                <label>Fiscal Year End</label>
                <select defaultValue="12">
                  <option value="12">December</option>
                  <option value="6">June</option>
                  <option value="3">March</option>
                </select>
              </div>
            </div>
            <p className="hint">Organization settings are configured at deployment. Contact admin to change.</p>
          </div>

          <div className="form-card">
            <h3>API Information</h3>
            <p><strong>Backend URL:</strong> {import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}</p>
            <p><strong>Org ID:</strong> demo-org</p>
          </div>
        </div>
      )}

      {tab === "coa" && (
        <div className="settings-section">
          <div className="toolbar">
            <button className="btn" onClick={() => setShowAccountForm(!showAccountForm)}>
              {showAccountForm ? "Cancel" : "+ Add Account"}
            </button>
          </div>

          {showAccountForm && (
            <div className="form-card">
              <h3>Add Account</h3>
              <div className="form-grid">
                <div className="form-row">
                  <label>Code</label>
                  <input value={accountForm.code} onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} placeholder="e.g., 1100" />
                </div>
                <div className="form-row">
                  <label>Name</label>
                  <input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Type</label>
                  <select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}>
                    <option value="ASSET">Asset</option>
                    <option value="LIABILITY">Liability</option>
                    <option value="EQUITY">Equity</option>
                    <option value="REVENUE">Revenue</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>Currency</label>
                  <input value={accountForm.currency} onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value })} />
                </div>
              </div>
              <button className="btn" onClick={createAccount}>Add Account</button>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Currency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td>{acc.code}</td>
                  <td>{acc.name}</td>
                  <td><span className={`badge ${acc.type.toLowerCase()}`}>{acc.type}</span></td>
                  <td>{acc.currency}</td>
                  <td><span className={`badge ${acc.isActive ? "active" : "inactive"}`}>{acc.isActive ? "Active" : "Inactive"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "tax" && (
        <div className="settings-section">
          <div className="toolbar">
            <button className="btn" onClick={() => setShowTaxForm(!showTaxForm)}>
              {showTaxForm ? "Cancel" : "+ Add Tax Rate"}
            </button>
          </div>

          {showTaxForm && (
            <div className="form-card">
              <h3>Add Tax Rate</h3>
              <div className="form-grid">
                <div className="form-row">
                  <label>Name</label>
                  <input value={taxForm.name} onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })} placeholder="e.g., GST 10%" />
                </div>
                <div className="form-row">
                  <label>Rate (%)</label>
                  <input type="number" value={taxForm.rate} onChange={(e) => setTaxForm({ ...taxForm, rate: parseFloat(e.target.value) })} />
                </div>
                <div className="form-row">
                  <label>Type</label>
                  <select value={taxForm.type} onChange={(e) => setTaxForm({ ...taxForm, type: e.target.value })}>
                    <option value="sales">Sales Tax / GST / VAT</option>
                    <option value="income">Income Tax</option>
                    <option value="payroll">Payroll Tax</option>
                    <option value="withholding">Withholding Tax</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>Jurisdiction</label>
                  <input value={taxForm.jurisdiction} onChange={(e) => setTaxForm({ ...taxForm, jurisdiction: e.target.value })} placeholder="e.g., Australia" />
                </div>
                <div className="form-row checkbox">
                  <label>
                    <input type="checkbox" checked={taxForm.isDefault} onChange={(e) => setTaxForm({ ...taxForm, isDefault: e.target.checked })} />
                    Set as default for this type
                  </label>
                </div>
              </div>
              <button className="btn" onClick={createTaxRate}>Add Tax Rate</button>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rate</th>
                <th>Type</th>
                <th>Jurisdiction</th>
                <th>Default</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {taxRates.map((rate) => (
                <tr key={rate.id}>
                  <td>{rate.name}</td>
                  <td>{rate.rate}%</td>
                  <td>{rate.type}</td>
                  <td>{rate.jurisdiction || "-"}</td>
                  <td>{rate.isDefault ? "✓" : ""}</td>
                  <td><span className={`badge ${rate.isActive ? "active" : "inactive"}`}>{rate.isActive ? "Active" : "Inactive"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

