import { useState } from "react";
import { api } from "../lib/api";
import { hmacSha256 } from "../lib/hmac";

const orgId = "demo-org";

const IngestionPage = () => {
  const [walletStatus, setWalletStatus] = useState("");
  const [cexStatus, setCexStatus] = useState("");
  const [bankStatus, setBankStatus] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("change-me-webhook");

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

  return (
    <div>
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



