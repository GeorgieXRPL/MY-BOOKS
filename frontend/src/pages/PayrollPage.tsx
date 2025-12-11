import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Employee {
  id: string;
  name: string;
  email: string;
  position: string;
  baseSalary: number;
  currency: string;
  isActive: boolean;
}

interface PayrollRun {
  id: string;
  period: string;
  totalGross: number;
  totalTax: number;
  totalNet: number;
  currency: string;
  status: string;
}

const PayrollPage = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [tab, setTab] = useState<"employees" | "runs">("runs");
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showRunForm, setShowRunForm] = useState(false);
  const [empForm, setEmpForm] = useState({
    name: "",
    email: "",
    position: "",
    baseSalary: 0,
    currency: "USD",
    startDate: new Date().toISOString().split("T")[0],
    isActive: true,
    orgId: "demo-org"
  });
  const [runForm, setRunForm] = useState({
    period: new Date().toISOString().slice(0, 7),
    currency: "USD",
    orgId: "demo-org"
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadEmployees();
    loadRuns();
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await api.get("/payroll/employees?orgId=demo-org");
      setEmployees(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const loadRuns = async () => {
    try {
      const res = await api.get("/payroll/runs?orgId=demo-org");
      setRuns(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const createEmployee = async () => {
    try {
      await api.post("/payroll/employees", empForm);
      setShowEmployeeForm(false);
      setEmpForm({ name: "", email: "", position: "", baseSalary: 0, currency: "USD", startDate: new Date().toISOString().split("T")[0], isActive: true, orgId: "demo-org" });
      loadEmployees();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const createRun = async () => {
    try {
      await api.post("/payroll/runs", runForm);
      setShowRunForm(false);
      loadRuns();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const calculateTaxes = async (id: string) => {
    try {
      await api.post(`/payroll/runs/${id}/calculate`, { taxRate: 20 });
      loadRuns();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const approveRun = async (id: string) => {
    try {
      await api.post(`/payroll/runs/${id}/approve`);
      loadRuns();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const finalizeRun = async (id: string) => {
    try {
      await api.post(`/payroll/runs/${id}/finalize`);
      loadRuns();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  return (
    <div className="page">
      <h2>Payroll</h2>

      <div className="tabs">
        <button className={tab === "runs" ? "active" : ""} onClick={() => setTab("runs")}>Payroll Runs</button>
        <button className={tab === "employees" ? "active" : ""} onClick={() => setTab("employees")}>Employees</button>
      </div>

      {status && <p className="status">{status}</p>}

      {tab === "employees" && (
        <>
          <div className="toolbar">
            <button className="btn" onClick={() => setShowEmployeeForm(!showEmployeeForm)}>
              {showEmployeeForm ? "Cancel" : "+ Add Employee"}
            </button>
          </div>

          {showEmployeeForm && (
            <div className="form-card">
              <h3>Add Employee</h3>
              <div className="form-grid">
                <div className="form-row">
                  <label>Name</label>
                  <input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Email</label>
                  <input value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Position</label>
                  <input value={empForm.position} onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Base Salary</label>
                  <input type="number" value={empForm.baseSalary} onChange={(e) => setEmpForm({ ...empForm, baseSalary: parseFloat(e.target.value) })} />
                </div>
                <div className="form-row">
                  <label>Start Date</label>
                  <input type="date" value={empForm.startDate} onChange={(e) => setEmpForm({ ...empForm, startDate: e.target.value })} />
                </div>
              </div>
              <button className="btn" onClick={createEmployee}>Add Employee</button>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Position</th>
                <th>Base Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.name}</td>
                  <td>{emp.email}</td>
                  <td>{emp.position}</td>
                  <td>${emp.baseSalary.toLocaleString()}</td>
                  <td><span className={`badge ${emp.isActive ? "active" : "inactive"}`}>{emp.isActive ? "Active" : "Inactive"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "runs" && (
        <>
          <div className="toolbar">
            <button className="btn" onClick={() => setShowRunForm(!showRunForm)}>
              {showRunForm ? "Cancel" : "+ New Payroll Run"}
            </button>
          </div>

          {showRunForm && (
            <div className="form-card">
              <h3>Create Payroll Run</h3>
              <div className="form-row">
                <label>Period (YYYY-MM)</label>
                <input type="month" value={runForm.period} onChange={(e) => setRunForm({ ...runForm, period: e.target.value })} />
              </div>
              <button className="btn" onClick={createRun}>Create Run</button>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Gross</th>
                <th>Tax</th>
                <th>Net</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.period}</td>
                  <td>${run.totalGross.toLocaleString()}</td>
                  <td>${run.totalTax.toLocaleString()}</td>
                  <td>${run.totalNet.toLocaleString()}</td>
                  <td><span className={`badge ${run.status}`}>{run.status}</span></td>
                  <td>
                    {run.status === "draft" && <button className="btn small" onClick={() => calculateTaxes(run.id)}>Calculate</button>}
                    {run.status === "calculated" && <button className="btn small" onClick={() => approveRun(run.id)}>Approve</button>}
                    {run.status === "approved" && <button className="btn small" onClick={() => finalizeRun(run.id)}>Finalize</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default PayrollPage;



