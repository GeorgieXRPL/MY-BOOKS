import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface CryptoTxn {
  id: string;
  type: string;
  tokenSymbol: string;
  quantity: number;
  priceUsd: number;
  valueUsd: number;
  feeUsd: number;
  timestamp: string;
}

interface CryptoLot {
  id: string;
  tokenSymbol: string;
  quantity: number;
  costBasisUsd: number;
  remainingQty: number;
  acquiredAt: string;
}

const CryptoPage = () => {
  const [txns, setTxns] = useState<CryptoTxn[]>([]);
  const [lots, setLots] = useState<CryptoLot[]>([]);
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"transactions" | "lots" | "holdings">("holdings");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    walletId: "main-wallet",
    txHash: "",
    type: "transfer" as string,
    tokenSymbol: "ETH",
    quantity: 0,
    priceUsd: 0,
    feeUsd: 0,
    timestamp: new Date().toISOString()
  });
  const [gainCalc, setGainCalc] = useState({
    tokenSymbol: "ETH",
    disposalQty: 0,
    disposalPriceUsd: 0,
    method: "fifo"
  });
  const [gainResult, setGainResult] = useState<any>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txnRes, lotRes, holdRes] = await Promise.all([
        api.get("/crypto/transactions?orgId=demo-org"),
        api.get("/crypto/lots?orgId=demo-org"),
        api.get("/crypto/holdings?orgId=demo-org")
      ]);
      setTxns(txnRes.data);
      setLots(lotRes.data);
      setHoldings(holdRes.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const recordTxn = async () => {
    try {
      await api.post("/crypto/transactions", { orgId: "demo-org", ...form });
      setShowForm(false);
      setForm({ walletId: "main-wallet", txHash: "", type: "transfer", tokenSymbol: "ETH", quantity: 0, priceUsd: 0, feeUsd: 0, timestamp: new Date().toISOString() });
      loadData();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const calculateGain = async () => {
    try {
      const res = await api.post("/crypto/calculate-gain", { orgId: "demo-org", ...gainCalc });
      setGainResult(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const totalHoldingsValue = Object.entries(holdings).reduce((sum, [_, qty]) => sum + qty * 2000, 0); // Placeholder price

  return (
    <div className="page">
      <h2>Crypto Transactions</h2>

      <div className="summary-bar">
        {Object.entries(holdings).map(([symbol, qty]) => (
          <div key={symbol} className="summary-item">
            <span className="label">{symbol}</span>
            <span className="value">{qty.toFixed(4)}</span>
          </div>
        ))}
      </div>

      <div className="tabs">
        <button className={tab === "holdings" ? "active" : ""} onClick={() => setTab("holdings")}>Holdings</button>
        <button className={tab === "transactions" ? "active" : ""} onClick={() => setTab("transactions")}>Transactions</button>
        <button className={tab === "lots" ? "active" : ""} onClick={() => setTab("lots")}>Cost Basis Lots</button>
      </div>

      {status && <p className="status">{status}</p>}

      {tab === "holdings" && (
        <div className="holdings-section">
          <div className="toolbar">
            <button className="btn" onClick={() => setShowForm(!showForm)}>+ Record Transaction</button>
          </div>

          {showForm && (
            <div className="form-card">
              <h3>Record Crypto Transaction</h3>
              <div className="form-grid">
                <div className="form-row">
                  <label>Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="transfer">Transfer In</option>
                    <option value="reward">Staking Reward</option>
                    <option value="stake">Stake</option>
                    <option value="unstake">Unstake</option>
                    <option value="swap">Swap</option>
                    <option value="fee">Fee</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>Token</label>
                  <input value={form.tokenSymbol} onChange={(e) => setForm({ ...form, tokenSymbol: e.target.value.toUpperCase() })} />
                </div>
                <div className="form-row">
                  <label>Quantity</label>
                  <input type="number" step="0.0001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) })} />
                </div>
                <div className="form-row">
                  <label>Price (USD)</label>
                  <input type="number" step="0.01" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: parseFloat(e.target.value) })} />
                </div>
                <div className="form-row">
                  <label>Fee (USD)</label>
                  <input type="number" step="0.01" value={form.feeUsd} onChange={(e) => setForm({ ...form, feeUsd: parseFloat(e.target.value) })} />
                </div>
                <div className="form-row">
                  <label>Tx Hash</label>
                  <input value={form.txHash} onChange={(e) => setForm({ ...form, txHash: e.target.value })} placeholder="0x..." />
                </div>
              </div>
              <button className="btn" onClick={recordTxn}>Record</button>
            </div>
          )}

          <div className="form-card">
            <h3>Calculate Realized Gain</h3>
            <div className="form-grid">
              <div className="form-row">
                <label>Token</label>
                <input value={gainCalc.tokenSymbol} onChange={(e) => setGainCalc({ ...gainCalc, tokenSymbol: e.target.value.toUpperCase() })} />
              </div>
              <div className="form-row">
                <label>Disposal Qty</label>
                <input type="number" step="0.0001" value={gainCalc.disposalQty} onChange={(e) => setGainCalc({ ...gainCalc, disposalQty: parseFloat(e.target.value) })} />
              </div>
              <div className="form-row">
                <label>Sale Price (USD)</label>
                <input type="number" step="0.01" value={gainCalc.disposalPriceUsd} onChange={(e) => setGainCalc({ ...gainCalc, disposalPriceUsd: parseFloat(e.target.value) })} />
              </div>
              <div className="form-row">
                <label>Method</label>
                <select value={gainCalc.method} onChange={(e) => setGainCalc({ ...gainCalc, method: e.target.value })}>
                  <option value="fifo">FIFO</option>
                  <option value="lifo">LIFO</option>
                  <option value="average">Average Cost</option>
                </select>
              </div>
            </div>
            <button className="btn" onClick={calculateGain}>Calculate</button>

            {gainResult && (
              <div className="gain-result">
                <p><strong>Proceeds:</strong> ${gainResult.proceeds?.toFixed(2)}</p>
                <p><strong>Cost Basis:</strong> ${gainResult.costBasis?.toFixed(2)}</p>
                <p className={gainResult.realizedGain >= 0 ? "gain" : "loss"}>
                  <strong>Realized Gain/Loss:</strong> ${gainResult.realizedGain?.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Token</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Value</th>
              <th>Fee</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((txn) => (
              <tr key={txn.id}>
                <td>{new Date(txn.timestamp).toLocaleDateString()}</td>
                <td><span className="badge">{txn.type}</span></td>
                <td>{txn.tokenSymbol}</td>
                <td>{txn.quantity.toFixed(4)}</td>
                <td>${txn.priceUsd.toFixed(2)}</td>
                <td>${txn.valueUsd.toFixed(2)}</td>
                <td>${txn.feeUsd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "lots" && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Acquired</th>
              <th>Token</th>
              <th>Original Qty</th>
              <th>Remaining</th>
              <th>Cost Basis</th>
              <th>Cost/Unit</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className={lot.remainingQty === 0 ? "depleted" : ""}>
                <td>{new Date(lot.acquiredAt).toLocaleDateString()}</td>
                <td>{lot.tokenSymbol}</td>
                <td>{lot.quantity.toFixed(4)}</td>
                <td>{lot.remainingQty.toFixed(4)}</td>
                <td>${lot.costBasisUsd.toFixed(2)}</td>
                <td>${(lot.costBasisUsd / lot.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CryptoPage;



