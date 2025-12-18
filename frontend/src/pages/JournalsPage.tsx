import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";

type Journal = {
  id: string;
  status: string;
  period: string;
  memo?: string;
  lines: { accountId: string; debit: number; credit: number; description?: string }[];
  createdBy: string;
  reviewedBy?: string;
  postedBy?: string;
  createdAt: string;
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
  const { user } = useAuthStore();
  const roles = user?.roles ?? [];

  const fetchJournals = async () => {
    try {
      const res = await api.get("/ledger/journals");
      setJournals(res.data);
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get("/ledger/accounts");
      setAccounts(res.data);
      if (!debitAcct && res.data.length) {
        setDebitAcct(res.data[0].id);
        if (res.data[1]) setCreditAcct(res.data[1].id);
      }
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
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
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Period</th>
              <th>Memo</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {journals.map((j) => (
              <tr key={j.id}>
                <td>{j.id}</td>
                <td>
                  <span className="badge">{j.status}</span>
                </td>
                <td>{j.period}</td>
                <td>{j.memo}</td>
                <td className="row" style={{ gap: 4 }}>
                  {j.status === "draft" && (
                    <button className="btn secondary" onClick={() => review(j.id)}>
                      Review
                    </button>
                  )}
                  {j.status === "reviewed" && (
                    <button className="btn" onClick={() => post(j.id)}>
                      Post
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JournalsPage;

