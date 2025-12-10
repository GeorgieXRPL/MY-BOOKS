import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Asset {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  currency: string;
  isActive: boolean;
  accumulatedDepreciation?: number;
  bookValue?: number;
}

interface DepEntry {
  id: string;
  period: string;
  amount: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

const AssetsPage = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [schedule, setSchedule] = useState<DepEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Equipment",
    purchaseDate: new Date().toISOString().split("T")[0],
    cost: 0,
    salvageValue: 0,
    usefulLifeMonths: 60,
    depreciationMethod: "straight-line",
    accountId: "",
    depreciationAccountId: "",
    currency: "USD"
  });
  const [depPeriod, setDepPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadAssets();
    loadAccounts();
  }, []);

  const loadAssets = async () => {
    try {
      const res = await api.get("/assets/reports/register?orgId=demo-org");
      setAssets(res.data);
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

  const loadSchedule = async (assetId: string) => {
    try {
      const res = await api.get(`/assets/${assetId}/schedule`);
      setSchedule(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const createAsset = async () => {
    try {
      await api.post("/assets", { orgId: "demo-org", ...form });
      setShowForm(false);
      setForm({ name: "", description: "", category: "Equipment", purchaseDate: new Date().toISOString().split("T")[0], cost: 0, salvageValue: 0, usefulLifeMonths: 60, depreciationMethod: "straight-line", accountId: "", depreciationAccountId: "", currency: "USD" });
      loadAssets();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const recordDepreciation = async (assetId: string) => {
    try {
      await api.post(`/assets/${assetId}/depreciate`, { period: depPeriod });
      loadAssets();
      if (selectedAsset?.id === assetId) loadSchedule(assetId);
      setStatus("Depreciation recorded!");
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const selectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    loadSchedule(asset.id);
  };

  const totalCost = assets.reduce((s, a) => s + a.cost, 0);
  const totalBookValue = assets.reduce((s, a) => s + (a.bookValue || a.cost), 0);

  return (
    <div className="page">
      <h2>Assets & Depreciation</h2>

      <div className="summary-bar">
        <div className="summary-item">
          <span className="label">Total Assets</span>
          <span className="value">{assets.length}</span>
        </div>
        <div className="summary-item">
          <span className="label">Original Cost</span>
          <span className="value">${totalCost.toLocaleString()}</span>
        </div>
        <div className="summary-item">
          <span className="label">Book Value</span>
          <span className="value">${totalBookValue.toLocaleString()}</span>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Asset"}
        </button>
        <div className="dep-period">
          <label>Depreciation Period:</label>
          <input type="month" value={depPeriod} onChange={(e) => setDepPeriod(e.target.value)} />
        </div>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Add Asset</h3>
          <div className="form-grid">
            <div className="form-row">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="Equipment">Equipment</option>
                <option value="Furniture">Furniture</option>
                <option value="Vehicles">Vehicles</option>
                <option value="Buildings">Buildings</option>
                <option value="Software">Software</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-row">
              <label>Purchase Date</label>
              <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Cost</label>
              <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Salvage Value</label>
              <input type="number" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: parseFloat(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Useful Life (months)</label>
              <input type="number" value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: parseInt(e.target.value) })} />
            </div>
            <div className="form-row">
              <label>Depreciation Method</label>
              <select value={form.depreciationMethod} onChange={(e) => setForm({ ...form, depreciationMethod: e.target.value })}>
                <option value="straight-line">Straight Line</option>
                <option value="declining-balance">Declining Balance</option>
              </select>
            </div>
            <div className="form-row">
              <label>Asset Account</label>
              <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">Select...</option>
                {accounts.filter((a) => a.type === "ASSET").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Depreciation Expense Account</label>
              <select value={form.depreciationAccountId} onChange={(e) => setForm({ ...form, depreciationAccountId: e.target.value })}>
                <option value="">Select...</option>
                {accounts.filter((a) => a.type === "EXPENSE").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn" onClick={createAsset}>Add Asset</button>
        </div>
      )}

      {status && <p className="status">{status}</p>}

      <div className="asset-layout">
        <div className="asset-list">
          <h3>Asset Register</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Cost</th>
                <th>Accum. Dep.</th>
                <th>Book Value</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className={selectedAsset?.id === asset.id ? "selected" : ""} onClick={() => selectAsset(asset)}>
                  <td>{asset.name}</td>
                  <td>{asset.category}</td>
                  <td>${asset.cost.toLocaleString()}</td>
                  <td>${(asset.accumulatedDepreciation || 0).toLocaleString()}</td>
                  <td>${(asset.bookValue || asset.cost).toLocaleString()}</td>
                  <td>
                    <button className="btn small" onClick={(e) => { e.stopPropagation(); recordDepreciation(asset.id); }}>
                      Depreciate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedAsset && (
          <div className="schedule-panel">
            <h3>Depreciation Schedule: {selectedAsset.name}</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Accumulated</th>
                  <th>Book Value</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.period}</td>
                    <td>${entry.amount.toFixed(2)}</td>
                    <td>${entry.accumulatedDepreciation.toFixed(2)}</td>
                    <td>${entry.bookValue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetsPage;

