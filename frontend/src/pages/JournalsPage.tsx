import { useEffect, useState } from "react";
import { api, safeArray } from "../lib/api";
import { useAuthStore } from "../store/auth";

type JournalLine = { 
  accountId: string; 
  debit: number; 
  credit: number; 
  description?: string;
  currency?: string;
};

type Journal = {
  id: string;
  status: string;
  period: string;
  memo?: string;
  lines: JournalLine[];
  createdBy: string;
  reviewedBy?: string;
  postedBy?: string;
  createdAt: string;
  externalRef?: string;
};

type Account = { id: string; code: string; name: string; type: string };

const JournalsPage = () => {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [memo, setMemo] = useState("");
  const [period, setPeriod] = useState("2024-08");
  const [orgId] = useState("demo-org");
  const [status, setStatus] = useState("");
  const [amount, setAmount] = useState(100);
  const [debitAcct, setDebitAcct] = useState("");
  const [creditAcct, setCreditAcct] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const roles = user?.roles ?? [];

  // Helper to get account name by ID
  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} — ${account.name}` : accountId;
  };

  // Calculate total debits/credits for a journal
  const getJournalTotals = (lines: JournalLine[]) => {
    const debits = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const credits = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    return { debits, credits };
  };

  const fetchJournals = async () => {
    try {
      const res = await api.get("/ledger/journals");
      const data = safeArray(res.data?.items || res.data);
      setJournals(data);
    } catch (err: any) {
      console.warn("Failed to load journals:", err);
      setJournals([]);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get("/ledger/accounts");
      const data = safeArray(res.data);
      setAccounts(data);
      if (!debitAcct && data.length) {
        setDebitAcct(data[0].id);
        if (data[1]) setCreditAcct(data[1].id);
      }
    } catch (err: any) {
      console.warn("Failed to load accounts:", err);
      setAccounts([]);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchJournals();
  }, []);

  const createDraft = async () => {
    setStatus("Creating draft...");
    try {
      const res = await api.post("/ledger/journals", {
        orgId,
        period,
        memo,
        createdBy: "ui-user",
        lines: [
          { accountId: debitAcct, debit: amount, credit: 0, currency: "USD", description: "Debit" },
          { accountId: creditAcct, debit: 0, credit: amount, currency: "USD", description: "Credit" }
        ]
      });
      setStatus("Draft created");
      setMemo("");
      setAmount(100);
      setJournals((prev) => [...prev, res.data]);
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
    }
  };

  const review = async (id: string) => {
    setStatus("Reviewing...");
    try {
      await api.post(`/ledger/journals/${id}/review`, { reviewerId: "ui-reviewer" });
      setStatus("Reviewed");
      fetchJournals();
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
    }
  };

  const post = async (id: string) => {
    setStatus("Posting...");
    try {
      await api.post(`/ledger/journals/${id}/post`, { posterId: "ui-poster" });
      setStatus("Posted");
      fetchJournals();
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Create Draft Journal</h2>
        <div className="row">
          <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" />
          <input
            className="input"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Amount"
          />
        </div>
        <div className="row">
          <select className="input" value={debitAcct} onChange={(e) => setDebitAcct(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <select className="input" value={creditAcct} onChange={(e) => setCreditAcct(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="input"
          style={{ marginTop: 8, height: 80 }}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Memo"
        />
        <button className="btn" onClick={createDraft} disabled={!roles.length}>
          Create Draft
        </button>
        <p className="status">{status}</p>
      </div>

      <div className="card">
        <h2>Journals</h2>
        <p style={{ color: "#666", marginBottom: 16 }}>Click on a journal to view details</p>
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Status</th>
              <th>Period</th>
              <th>Memo</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {journals.map((j) => {
              const totals = getJournalTotals(j.lines || []);
              const isExpanded = expandedId === j.id;
              return (
                <>
                  <tr key={j.id} onClick={() => setExpandedId(isExpanded ? null : j.id)} style={{ cursor: "pointer" }}>
                    <td style={{ width: 30 }}>{isExpanded ? "▼" : "▶"}</td>
                    <td>
                      <span className={`badge ${j.status}`}>{j.status}</span>
                    </td>
                    <td>{j.period}</td>
                    <td>{j.memo || j.externalRef || "—"}</td>
                    <td>${totals.debits.toFixed(2)}</td>
                    <td className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      {j.status === "draft" && (
                        <button className="btn secondary" onClick={() => review(j.id)}>
                          ✓ Approve
                        </button>
                      )}
                      {j.status === "reviewed" && (
                        <button className="btn" onClick={() => post(j.id)}>
                          📤 Post
                        </button>
                      )}
                      {j.status === "posted" && <span style={{ color: "#4CAF50" }}>✓ Posted</span>}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${j.id}-details`}>
                      <td colSpan={6} style={{ background: "#f9f9f9", padding: 16 }}>
                        <div style={{ marginBottom: 12 }}>
                          <strong>Journal Entry Details</strong>
                          {j.externalRef && <span style={{ marginLeft: 12, color: "#666" }}>Ref: {j.externalRef}</span>}
                          <span style={{ marginLeft: 12, color: "#666" }}>Created: {new Date(j.createdAt).toLocaleDateString()}</span>
                        </div>
                        <table className="table" style={{ marginBottom: 0 }}>
                          <thead>
                            <tr>
                              <th>Account</th>
                              <th>Description</th>
                              <th style={{ textAlign: "right" }}>Debit</th>
                              <th style={{ textAlign: "right" }}>Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(j.lines || []).map((line, idx) => (
                              <tr key={idx}>
                                <td>{getAccountName(line.accountId)}</td>
                                <td>{line.description || "—"}</td>
                                <td style={{ textAlign: "right" }}>{line.debit > 0 ? `$${line.debit.toFixed(2)}` : ""}</td>
                                <td style={{ textAlign: "right" }}>{line.credit > 0 ? `$${line.credit.toFixed(2)}` : ""}</td>
                              </tr>
                            ))}
                            <tr style={{ fontWeight: "bold", borderTop: "2px solid #ccc" }}>
                              <td colSpan={2}>Total</td>
                              <td style={{ textAlign: "right" }}>${totals.debits.toFixed(2)}</td>
                              <td style={{ textAlign: "right" }}>${totals.credits.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                        {totals.debits !== totals.credits && (
                          <p style={{ color: "red", marginTop: 8 }}>⚠️ Debits and Credits do not balance!</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JournalsPage;

