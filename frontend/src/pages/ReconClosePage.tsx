import { useEffect, useState } from "react";
import { api } from "../lib/api";

const orgId = "demo-org";

type ReconItem = {
  id: string;
  source: string;
  externalRef: string;
  delta: number;
  status: string;
  note?: string;
};

type ChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
};

const ReconClosePage = () => {
  const [period, setPeriod] = useState("2024-08");
  const [recons, setRecons] = useState<ReconItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [status, setStatus] = useState("");

  const loadRecons = async () => {
    try {
      const res = await api.get("/reports/reconciliations", { params: { orgId } });
      setRecons(res.data);
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
    }
  };

  const addRecon = async () => {
    setStatus("Reconciling...");
    try {
      const res = await api.post("/reports/reconciliations", {
        orgId,
        source: "wallet",
        externalRef: `ref-${Date.now()}`,
        externalBalance: 1000,
        ledgerBalance: 995,
        note: "Sample discrepancy"
      });
      setRecons((prev) => [...prev, res.data]);
      setStatus("Recon added");
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
    }
  };

  const loadChecklist = async () => {
    try {
      const res = await api.get("/close", { params: { orgId, period } });
      setChecklist(res.data);
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
    }
  };

  const seedChecklist = async () => {
    try {
      const res = await api.post("/close/seed", { orgId, period });
      setChecklist(res.data);
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
    }
  };

  const completeItem = async (id: string) => {
    try {
      await api.post(`/close/${id}/complete`);
      loadChecklist();
    } catch (err: any) {
      setStatus(err?.response?.data?.error || err.message);
    }
  };

  useEffect(() => {
    loadRecons();
    loadChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="card">
        <h2>Reconciliations</h2>
        <button className="btn" onClick={addRecon}>
          Add Sample Recon
        </button>
        <table className="table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Source</th>
              <th>Ref</th>
              <th>Delta</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {recons.map((r) => (
              <tr key={r.id}>
                <td>{r.source}</td>
                <td>{r.externalRef}</td>
                <td>{r.delta}</td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Close Checklist</h2>
        <div className="row">
          <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <button className="btn secondary" onClick={seedChecklist}>
            Seed Steps
          </button>
          <button className="btn" onClick={loadChecklist}>
            Refresh
          </button>
        </div>
        <ul>
          {checklist.map((c) => (
            <li key={c.id} style={{ margin: "6px 0" }}>
              <span className="badge" style={{ marginRight: 8 }}>
                {c.completed ? "done" : "open"}
              </span>
              {c.title}
              {!c.completed && (
                <button className="btn secondary" style={{ marginLeft: 8 }} onClick={() => completeItem(c.id)}>
                  Mark done
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="status">{status}</p>
    </div>
  );
};

export default ReconClosePage;



