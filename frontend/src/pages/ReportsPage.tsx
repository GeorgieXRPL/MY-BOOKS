import { useEffect, useState } from "react";
import { api } from "../lib/api";

const orgId = "demo-org";

const ReportsPage = () => {
  const [period, setPeriod] = useState("2024-08");
  const [bs, setBs] = useState<any>(null);
  const [is, setIs] = useState<any>(null);
  const [cf, setCf] = useState<any>(null);
  const [treasury, setTreasury] = useState<any>(null);
  const [status, setStatus] = useState("");

  const load = async () => {
    setStatus("Loading...");
    try {
      const [bsRes, isRes, cfRes, trRes] = await Promise.allSettled([
        api.get("/reports/balance-sheet", { params: { orgId, period } }),
        api.get("/reports/income-statement", { params: { orgId, period } }),
        api.get("/reports/cash-flow", { params: { orgId, period } }),
        api.get("/reports/treasury", { params: { orgId } })
      ]);
      setBs(bsRes.status === "fulfilled" ? bsRes.value.data : null);
      setIs(isRes.status === "fulfilled" ? isRes.value.data : null);
      setCf(cfRes.status === "fulfilled" ? cfRes.value.data : null);
      setTreasury(trRes.status === "fulfilled" ? trRes.value.data : null);
      setStatus("Loaded");
    } catch (err: any) {
      console.warn("Failed to load reports:", err);
      setStatus("Some reports failed to load");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="card">
        <h2>Reports</h2>
        <div className="row">
          <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <button className="btn" onClick={load}>
            Refresh
          </button>
        </div>
        <p className="status">{status}</p>
      </div>

      <div className="card">
        <h3>Balance Sheet</h3>
        <pre className="status">{bs ? JSON.stringify(bs, null, 2) : "—"}</pre>
      </div>
      <div className="card">
        <h3>Income Statement</h3>
        <pre className="status">{is ? JSON.stringify(is, null, 2) : "—"}</pre>
      </div>
      <div className="card">
        <h3>Cash Flow</h3>
        <pre className="status">{cf ? JSON.stringify(cf, null, 2) : "—"}</pre>
      </div>
      <div className="card">
        <h3>Treasury</h3>
        <pre className="status">{treasury ? JSON.stringify(treasury, null, 2) : "—"}</pre>
      </div>
    </div>
  );
};

export default ReportsPage;





