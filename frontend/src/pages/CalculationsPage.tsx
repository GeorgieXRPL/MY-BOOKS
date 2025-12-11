import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Ratio {
  name: string;
  value: number;
  formula: string;
  benchmark?: number;
  status: "good" | "warning" | "poor" | "neutral";
}

interface Formula {
  id: string;
  name: string;
  description?: string;
  expression: string;
  variables: string[];
  category: string;
}

const CalculationsPage = () => {
  const [tab, setTab] = useState<"ratios" | "formulas" | "tax">("ratios");
  const [ratios, setRatios] = useState<Ratio[]>([]);
  const [ratioSummary, setRatioSummary] = useState<any>(null);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [showFormulaForm, setShowFormulaForm] = useState(false);
  const [formulaForm, setFormulaForm] = useState({
    name: "",
    description: "",
    expression: "",
    variables: "",
    category: "custom"
  });
  const [evalContext, setEvalContext] = useState<Record<string, number>>({});
  const [evalResult, setEvalResult] = useState<any>(null);
  const [taxCalc, setTaxCalc] = useState({ amount: 0, rate: 10, inclusive: false });
  const [taxResult, setTaxResult] = useState<any>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadRatios();
    loadFormulas();
  }, []);

  const loadRatios = async () => {
    try {
      const res = await api.get("/calc/ratios/dashboard?orgId=demo-org");
      setRatios(res.data.ratios || []);
      setRatioSummary(res.data.summary);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const loadFormulas = async () => {
    try {
      const res = await api.get("/calc/formulas?orgId=demo-org");
      setFormulas(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const seedPresets = async () => {
    try {
      await api.post("/calc/formulas/seed-presets", { orgId: "demo-org" });
      loadFormulas();
      setStatus("Preset formulas added!");
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const createFormula = async () => {
    try {
      await api.post("/calc/formulas", {
        orgId: "demo-org",
        ...formulaForm,
        variables: formulaForm.variables.split(",").map((v) => v.trim()).filter(Boolean)
      });
      setShowFormulaForm(false);
      setFormulaForm({ name: "", description: "", expression: "", variables: "", category: "custom" });
      loadFormulas();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const evaluateFormula = async (id: string) => {
    try {
      const res = await api.post(`/calc/formulas/${id}/evaluate-auto`, { orgId: "demo-org" });
      setEvalResult(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const calculateTax = async () => {
    try {
      const res = await api.post("/calc/tax/calculate", taxCalc);
      setTaxResult(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  return (
    <div className="page">
      <h2>Calculations</h2>

      <div className="tabs">
        <button className={tab === "ratios" ? "active" : ""} onClick={() => setTab("ratios")}>Financial Ratios</button>
        <button className={tab === "formulas" ? "active" : ""} onClick={() => setTab("formulas")}>Custom Formulas</button>
        <button className={tab === "tax" ? "active" : ""} onClick={() => setTab("tax")}>Tax Calculator</button>
      </div>

      {status && <p className="status">{status}</p>}

      {tab === "ratios" && (
        <div className="ratios-section">
          {ratioSummary && (
            <div className="health-score">
              <h3>Financial Health Score</h3>
              <div className={`score ${ratioSummary.healthScore >= 70 ? "good" : ratioSummary.healthScore >= 40 ? "warning" : "poor"}`}>
                {ratioSummary.healthScore}%
              </div>
              <p>{ratioSummary.good} good | {ratioSummary.warning} warning | {ratioSummary.poor} poor</p>
            </div>
          )}

          <div className="ratios-grid">
            {ratios.map((ratio, idx) => (
              <div key={idx} className={`ratio-card ${ratio.status}`}>
                <h4>{ratio.name}</h4>
                <p className="value">{ratio.value.toFixed(2)}</p>
                <p className="formula">{ratio.formula}</p>
                {ratio.benchmark && <p className="benchmark">Benchmark: {ratio.benchmark}</p>}
                <span className={`badge ${ratio.status}`}>{ratio.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "formulas" && (
        <div className="formulas-section">
          <div className="toolbar">
            <button className="btn" onClick={() => setShowFormulaForm(!showFormulaForm)}>
              {showFormulaForm ? "Cancel" : "+ Create Formula"}
            </button>
            <button className="btn secondary" onClick={seedPresets}>Add Preset Formulas</button>
          </div>

          {showFormulaForm && (
            <div className="form-card">
              <h3>Create Custom Formula</h3>
              <div className="form-grid">
                <div className="form-row">
                  <label>Name</label>
                  <input value={formulaForm.name} onChange={(e) => setFormulaForm({ ...formulaForm, name: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Description</label>
                  <input value={formulaForm.description} onChange={(e) => setFormulaForm({ ...formulaForm, description: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Expression</label>
                  <input value={formulaForm.expression} onChange={(e) => setFormulaForm({ ...formulaForm, expression: e.target.value })} placeholder="e.g., (totalAssets - totalLiabilities) / totalEquity" />
                </div>
                <div className="form-row">
                  <label>Variables (comma-separated)</label>
                  <input value={formulaForm.variables} onChange={(e) => setFormulaForm({ ...formulaForm, variables: e.target.value })} placeholder="totalAssets, totalLiabilities, totalEquity" />
                </div>
                <div className="form-row">
                  <label>Category</label>
                  <select value={formulaForm.category} onChange={(e) => setFormulaForm({ ...formulaForm, category: e.target.value })}>
                    <option value="custom">Custom</option>
                    <option value="liquidity">Liquidity</option>
                    <option value="profitability">Profitability</option>
                    <option value="leverage">Leverage</option>
                    <option value="efficiency">Efficiency</option>
                  </select>
                </div>
              </div>
              <p className="hint">Available auto-variables: totalAssets, totalLiabilities, totalEquity, totalRevenue, totalExpenses, netIncome, grossProfit, workingCapital</p>
              <button className="btn" onClick={createFormula}>Create Formula</button>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Expression</th>
                <th>Variables</th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {formulas.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.name}</strong>
                    {f.description && <p className="small">{f.description}</p>}
                  </td>
                  <td><code>{f.expression}</code></td>
                  <td>{f.variables.join(", ")}</td>
                  <td>{f.category}</td>
                  <td>
                    <button className="btn small" onClick={() => evaluateFormula(f.id)}>Evaluate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {evalResult && (
            <div className="eval-result form-card">
              <h4>Result: {evalResult.formula?.name}</h4>
              <p className="big-number">{evalResult.result?.toFixed(4)}</p>
              <details>
                <summary>Variables used</summary>
                <pre>{JSON.stringify(evalResult.variables, null, 2)}</pre>
              </details>
            </div>
          )}
        </div>
      )}

      {tab === "tax" && (
        <div className="tax-section">
          <div className="form-card">
            <h3>Tax Calculator</h3>
            <div className="form-grid">
              <div className="form-row">
                <label>Amount</label>
                <input type="number" value={taxCalc.amount} onChange={(e) => setTaxCalc({ ...taxCalc, amount: parseFloat(e.target.value) })} />
              </div>
              <div className="form-row">
                <label>Tax Rate (%)</label>
                <input type="number" value={taxCalc.rate} onChange={(e) => setTaxCalc({ ...taxCalc, rate: parseFloat(e.target.value) })} />
              </div>
              <div className="form-row checkbox">
                <label>
                  <input type="checkbox" checked={taxCalc.inclusive} onChange={(e) => setTaxCalc({ ...taxCalc, inclusive: e.target.checked })} />
                  Amount includes tax
                </label>
              </div>
            </div>
            <button className="btn" onClick={calculateTax}>Calculate</button>

            {taxResult && (
              <div className="tax-result">
                <p><strong>Gross Amount:</strong> ${taxResult.grossAmount?.toFixed(2)}</p>
                <p><strong>Tax Amount:</strong> ${taxResult.taxAmount?.toFixed(2)}</p>
                <p><strong>Net Amount:</strong> ${taxResult.netAmount?.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalculationsPage;



