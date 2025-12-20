import { useState } from "react";
import { api } from "../lib/api";
import { hmacSha256 } from "../lib/hmac";

const orgId = "demo-org";

interface BlockchainTx {
  chain: string;
  txHash: string;
  from: string;
  to: string;
  valueDecimal: number;
  tokenSymbol: string;
  priceUsd?: number;
  valueUsd?: number;
  fee?: number;
  feeUsd?: number;
  status: string;
  blockTime?: string;
}

interface LookupResult {
  success: boolean;
  chain?: string;
  tx?: BlockchainTx;
  priceUsd?: number;
  valueUsd?: number;
  error?: string;
}

const IngestionPage = () => {
  const [walletStatus, setWalletStatus] = useState("");
  const [cexStatus, setCexStatus] = useState("");
  const [bankStatus, setBankStatus] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("change-me-webhook");
  
  // Blockchain ingestion state
  const [txHash, setTxHash] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [direction, setDirection] = useState<"auto" | "inflow" | "outflow">("auto");
  const [blockchainStatus, setBlockchainStatus] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const ingestWallet = async () => {
    setWalletStatus("Sending...");
    const payload = {
      actorId: "ui-user",
      period: "2024-08",
      transfers: [
        {
          orgId,
          walletId: "wallet-1",
          hash: `tx-${Date.now()}`,
          from: "0xabc",
          to: "0xme",
          value: 1,
          tokenSymbol: "eth",
          timestamp: new Date().toISOString(),
          gasFee: 0.01
        }
      ]
    };
    const body = JSON.stringify(payload);
    try {
      const sig = await hmacSha256(webhookSecret, body);
      const res = await api.post("/ingest/wallet", payload, {
        headers: { "x-webhook-signature": sig }
      });
      setWalletStatus(`OK: ${res.data.ingested} ingested`);
    } catch (err: any) {
      setWalletStatus(err?.response?.data?.error || err.message);
    }
  };

  const ingestCex = async () => {
    setCexStatus("Sending...");
    try {
      const res = await api.post("/ingest/cex", {
        actorId: "ui-user",
        period: "2024-08",
        trades: [
          {
            orgId,
            tradeId: `trade-${Date.now()}`,
            baseSymbol: "eth",
            quoteSymbol: "USD",
            side: "buy",
            quantity: 1,
            price: 2000,
            fee: 5,
            timestamp: new Date().toISOString()
          }
        ]
      });
      setCexStatus(`OK: ${res.data.ingested} ingested`);
    } catch (err: any) {
      setCexStatus(err?.response?.data?.error || err.message);
    }
  };

  const ingestBank = async () => {
    setBankStatus("Sending...");
    try {
      const res = await api.post("/ingest/bank", {
        actorId: "ui-user",
        period: "2024-08",
        txns: [
          {
            orgId,
            externalId: `bank-${Date.now()}`,
            amount: 500,
            currency: "USD",
            description: "Bank deposit",
            timestamp: new Date().toISOString()
          }
        ]
      });
      setBankStatus(`OK: ${res.data.ingested} ingested`);
    } catch (err: any) {
      setBankStatus(err?.response?.data?.error || err.message);
    }
  };

  // Blockchain functions
  const lookupBlockchainTx = async () => {
    if (!txHash.trim()) {
      setBlockchainStatus("Please enter a transaction hash");
      return;
    }

    setIsLoading(true);
    setBlockchainStatus("Looking up transaction...");
    setLookupResult(null);

    try {
      const res = await api.post("/ingest/blockchain/lookup", { txHash: txHash.trim() });
      setLookupResult(res.data);
      if (res.data.success) {
        setBlockchainStatus(`Found ${res.data.chain?.toUpperCase()} transaction`);
      } else {
        setBlockchainStatus(`Error: ${res.data.error}`);
      }
    } catch (err: any) {
      setBlockchainStatus(err?.response?.data?.error || err.message);
      setLookupResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const ingestBlockchainTx = async () => {
    if (!lookupResult?.success || !lookupResult.tx) {
      setBlockchainStatus("Please lookup a transaction first");
      return;
    }

    setIsLoading(true);
    setBlockchainStatus("Creating journal entry...");

    try {
      const res = await api.post("/ingest/blockchain/ingest", {
        txHash: txHash.trim(),
        orgId,
        period,
        direction
      });

      if (res.data.success) {
        setBlockchainStatus(`Journal created! ID: ${res.data.journalId}`);
        setTxHash("");
        setLookupResult(null);
      } else {
        setBlockchainStatus(`Error: ${res.data.error}`);
      }
    } catch (err: any) {
      setBlockchainStatus(err?.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatUsd = (value?: number) => {
    if (value === undefined) return "N/A";
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getChainName = (chain?: string) => {
    const names: Record<string, string> = {
      evm: "Ethereum/EVM",
      xrpl: "XRP Ledger",
      solana: "Solana",
      bitcoin: "Bitcoin"
    };
    return names[chain || ""] || chain?.toUpperCase() || "Unknown";
  };

  return (
    <div>
      {/* Blockchain Auto-Ingest Section */}
      <div className="card">
        <h2>🔗 Blockchain Auto-Ingest</h2>
        <p className="muted">Paste a transaction hash from any supported chain. We'll auto-detect the blockchain and fetch transaction details.</p>
        
        <div className="form-row" style={{ marginTop: 12 }}>
          <label>Transaction Hash</label>
          <input
            className="input"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x... (EVM) | ABC123... (XRPL) | base58... (Solana) | hex... (Bitcoin)"
            style={{ fontFamily: "monospace", fontSize: "0.9em" }}
          />
        </div>

        <div className="row" style={{ gap: 12, marginTop: 12 }}>
          <div>
            <label>Period</label>
            <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" />
          </div>
          <div>
            <label>Direction</label>
            <select className="input" value={direction} onChange={(e) => setDirection(e.target.value as any)}>
              <option value="auto">Auto-detect</option>
              <option value="inflow">Inflow (Received)</option>
              <option value="outflow">Outflow (Sent)</option>
            </select>
          </div>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <button className="btn secondary" onClick={lookupBlockchainTx} disabled={isLoading || !txHash.trim()}>
            {isLoading ? "Loading..." : "🔍 Lookup Transaction"}
          </button>
          {lookupResult?.success && (
            <button className="btn" onClick={ingestBlockchainTx} disabled={isLoading}>
              ✓ Create Journal Entry
            </button>
          )}
        </div>

        {blockchainStatus && <p className="status" style={{ marginTop: 12 }}>{blockchainStatus}</p>}

        {lookupResult?.success && lookupResult.tx && (
          <div className="preview-card" style={{ marginTop: 16, padding: 16, background: "var(--bg-secondary)", borderRadius: 8 }}>
            <h4 style={{ marginTop: 0 }}>Transaction Preview</h4>
            <table style={{ width: "100%", fontSize: "0.9em" }}>
              <tbody>
                <tr><td style={{ fontWeight: 500 }}>Chain</td><td>{getChainName(lookupResult.chain)}</td></tr>
                <tr><td style={{ fontWeight: 500 }}>Status</td><td><span className={`badge ${lookupResult.tx.status}`}>{lookupResult.tx.status}</span></td></tr>
                <tr><td style={{ fontWeight: 500 }}>From</td><td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{lookupResult.tx.from?.slice(0, 20)}...</td></tr>
                <tr><td style={{ fontWeight: 500 }}>To</td><td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{lookupResult.tx.to?.slice(0, 20)}...</td></tr>
                <tr><td style={{ fontWeight: 500 }}>Value</td><td>{lookupResult.tx.valueDecimal?.toFixed(6)} {lookupResult.tx.tokenSymbol}</td></tr>
                <tr><td style={{ fontWeight: 500 }}>USD Value</td><td>{formatUsd(lookupResult.valueUsd)}</td></tr>
                <tr><td style={{ fontWeight: 500 }}>Fee</td><td>{lookupResult.tx.fee?.toFixed(6)} {lookupResult.tx.tokenSymbol} ({formatUsd(lookupResult.tx.feeUsd)})</td></tr>
                {lookupResult.tx.blockTime && <tr><td style={{ fontWeight: 500 }}>Time</td><td>{new Date(lookupResult.tx.blockTime).toLocaleString()}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted" style={{ marginTop: 12, fontSize: "0.85em" }}>
          <strong>Supported chains:</strong> Ethereum, Polygon, Arbitrum, Base (EVM) • XRP Ledger • Solana • Bitcoin
        </p>
      </div>

      <div className="card">
        <h2>Wallet Ingestion</h2>
        <label>Webhook Secret</label>
        <input className="input" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
        <p className="muted">Computes HMAC over the body for /ingest/wallet.</p>
        <button className="btn" onClick={ingestWallet}>
          Send Sample Wallet Tx
        </button>
        <p className="status">{walletStatus}</p>
      </div>

      <div className="card">
        <h2>CEX Ingestion</h2>
        <button className="btn" onClick={ingestCex}>
          Send Sample Trade
        </button>
        <p className="status">{cexStatus}</p>
      </div>

      <div className="card">
        <h2>Bank Ingestion</h2>
        <button className="btn" onClick={ingestBank}>
          Send Sample Bank Tx
        </button>
        <p className="status">{bankStatus}</p>
      </div>
    </div>
  );
};

export default IngestionPage;





