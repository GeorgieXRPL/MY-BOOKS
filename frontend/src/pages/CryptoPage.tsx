import { useState, useEffect } from "react";
import { api, safeArray } from "../lib/api";

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
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);

  // Lookup blockchain transaction and auto-populate form
  const lookupTxHash = async () => {
    if (!form.txHash.trim()) {
      setStatus("Please enter a transaction hash");
      return;
    }

    setLookupLoading(true);
    setStatus("🔍 Looking up transaction...");
    setLookupResult(null);

    try {
      const res = await api.post("/ingest/blockchain/lookup", { txHash: form.txHash.trim() });
      
      if (res.data.success && res.data.tx) {
        const tx = res.data.tx;
        
        // Auto-populate the form with fetched data
        setForm(prev => ({
          ...prev,
          tokenSymbol: tx.tokenSymbol?.toUpperCase() || prev.tokenSymbol,
          quantity: Math.abs(tx.valueDecimal || 0),
          priceUsd: res.data.priceUsd || tx.priceUsd || 0,
          feeUsd: tx.feeUsd || tx.fee || 0,
          timestamp: tx.blockTime || prev.timestamp,
          // Infer type based on value direction
          type: tx.valueDecimal >= 0 ? "transfer" : "fee"
        }));

        setLookupResult(res.data);
        
        // Build status message
        const networkName = tx.networkName || res.data.chain?.toUpperCase();
        let statusMsg = `✅ Found ${networkName} transaction! Fields auto-populated.`;
        if (!res.data.priceUsd || res.data.priceUsd === 0) {
          statusMsg += " ⚠️ Please enter the current price manually.";
        }
        setStatus(statusMsg);
      } else {
        setStatus(`❌ ${res.data.error || "Transaction not found"}`);
      }
    } catch (err: any) {
      setStatus(`❌ Lookup failed: ${err?.response?.data?.error || err.message}`);
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txnRes, lotRes, holdRes] = await Promise.allSettled([
        api.get("/crypto/transactions?orgId=demo-org"),
        api.get("/crypto/lots?orgId=demo-org"),
        api.get("/crypto/holdings?orgId=demo-org")
      ]);
      setTxns(txnRes.status === "fulfilled" ? safeArray(txnRes.value.data) : []);
      setLots(lotRes.status === "fulfilled" ? safeArray(lotRes.value.data) : []);
      setHoldings(holdRes.status === "fulfilled" && holdRes.value.data ? holdRes.value.data : {});
    } catch (e: any) {
      console.warn("Failed to load crypto data:", e);
      setTxns([]);
      setLots([]);
      setHoldings({});
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
              
              {/* TX Hash Lookup - Primary Input */}
              <div style={{ marginBottom: 20, padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
                <label style={{ fontWeight: "bold", display: "block", marginBottom: 8 }}>
                  🔗 Transaction Hash (Auto-populate from blockchain)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input 
                    style={{ flex: 1, padding: "10px 12px", fontSize: 14 }}
                    value={form.txHash} 
                    onChange={(e) => setForm({ ...form, txHash: e.target.value })} 
                    placeholder="Paste tx hash: 0x... (EVM), r... (XRP), or any chain"
                    onKeyDown={(e) => e.key === "Enter" && lookupTxHash()}
                  />
                  <button 
                    className="btn" 
                    onClick={lookupTxHash}
                    disabled={lookupLoading || !form.txHash.trim()}
                    style={{ whiteSpace: "nowrap", padding: "10px 20px" }}
                  >
                    {lookupLoading ? "Looking up..." : "🔍 Lookup & Fill"}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "#666", marginTop: 8, marginBottom: 0 }}>
                  Supports: Ethereum, BSC/BNB, Polygon, Arbitrum, Base, Optimism, Avalanche, Fantom, XRP Ledger, Solana, Bitcoin
                </p>
              </div>

              {/* Lookup Result Display */}
              {lookupResult?.success && (
                <div style={{ background: "#e8f5e9", padding: 16, borderRadius: 8, marginBottom: 16, border: "1px solid #4CAF50" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ color: "#2e7d32" }}>
                      ✅ Transaction Found
                    </strong>
                    <span style={{ 
                      background: "#2e7d32", 
                      color: "white", 
                      padding: "2px 8px", 
                      borderRadius: 4, 
                      fontSize: 12 
                    }}>
                      {lookupResult.tx?.networkName || lookupResult.chain?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div><strong>From:</strong> <code style={{ fontSize: 11 }}>{lookupResult.tx?.from?.slice(0, 16)}...</code></div>
                    <div><strong>To:</strong> <code style={{ fontSize: 11 }}>{lookupResult.tx?.to?.slice(0, 16)}...</code></div>
                    <div>
                      <strong>Token:</strong> {lookupResult.tx?.tokenSymbol?.toUpperCase()}
                      {lookupResult.tx?.tokenAddress && (
                        <span style={{ color: "#666", fontSize: 11 }}> (Token)</span>
                      )}
                    </div>
                    <div><strong>Value:</strong> {lookupResult.tx?.valueDecimal?.toFixed(6)}</div>
                    <div>
                      <strong>USD Value:</strong> {
                        lookupResult.priceUsd && lookupResult.priceUsd > 0 
                          ? `$${lookupResult.valueUsd?.toFixed(2)}` 
                          : <span style={{ color: "#f57c00" }}>⚠️ Enter price below</span>
                      }
                    </div>
                    <div>
                      <strong>Price/Token:</strong> {
                        lookupResult.priceUsd && lookupResult.priceUsd > 0 
                          ? `$${lookupResult.priceUsd.toFixed(2)}` 
                          : <span style={{ color: "#f57c00" }}>Pending</span>
                      }
                    </div>
                  </div>
                  {/* Show token address for non-native tokens */}
                  {lookupResult.tx?.tokenAddress && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                      <strong>Token Contract:</strong> <code>{lookupResult.tx.tokenAddress.slice(0, 20)}...</code>
                    </div>
                  )}
                  {/* Show issuer for XRPL tokens */}
                  {lookupResult.tx?.tokenIssuer && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
                      <strong>Issuer:</strong> <code>{lookupResult.tx.tokenIssuer.slice(0, 20)}...</code>
                    </div>
                  )}
                  {(!lookupResult.priceUsd || lookupResult.priceUsd === 0) && (
                    <div style={{ marginTop: 12, padding: 8, background: "#fff8e1", borderRadius: 4, fontSize: 12 }}>
                      ⚠️ <strong>Price not available.</strong> Please enter the {lookupResult.tx?.tokenSymbol} price at the time of transaction.
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: "#2e7d32", marginTop: 8, marginBottom: 0 }}>
                    ↓ Fields below have been auto-filled. Review and adjust if needed.
                  </p>
                </div>
              )}

              {/* Form Fields */}
              <div className="form-grid">
                <div className="form-row">
                  <label>Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="transfer">Transfer In</option>
                    <option value="transfer_out">Transfer Out</option>
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
                  <input type="number" step="0.000001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-row">
                  <label>Price (USD)</label>
                  <input type="number" step="0.01" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-row">
                  <label>Fee (USD)</label>
                  <input type="number" step="0.01" value={form.feeUsd} onChange={(e) => setForm({ ...form, feeUsd: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-row">
                  <label>Description (optional)</label>
                  <input placeholder="e.g., Payment for services" />
                </div>
              </div>
              <button className="btn" onClick={recordTxn} style={{ marginTop: 16 }}>
                ✓ Record Transaction
              </button>
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



