import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Invoice {
  id: string;
  invoiceNumber: string;
  type: "receivable" | "payable";
  counterpartyName: string;
  total: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  accountId: string;
  taxRate: number;
}

const InvoicesPage = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "receivable" | "payable">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: "receivable" as "receivable" | "payable",
    counterpartyId: "",
    counterpartyName: "",
    currency: "USD",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    notes: ""
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, accountId: "", taxRate: 10 }
  ]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadInvoices();
    loadAccounts();
  }, [filter]);

  const loadInvoices = async () => {
    try {
      const typeParam = filter === "all" ? "" : `&type=${filter}`;
      const res = await api.get(`/invoices?orgId=demo-org${typeParam}`);
      setInvoices(res.data);
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/ledger/accounts?orgId=demo-org");
      setAccounts(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unitPrice: 0, accountId: "", taxRate: 10 }]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = value;
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, li) => {
      const amount = li.quantity * li.unitPrice;
      const tax = amount * (li.taxRate / 100);
      return sum + amount + tax;
    }, 0);
  };

  const createInvoice = async () => {
    try {
      setStatus("Creating...");
      await api.post("/invoices", {
        orgId: "demo-org",
        ...form,
        lineItems
      });
      setStatus("Invoice created!");
      setShowForm(false);
      setForm({ type: "receivable", counterpartyId: "", counterpartyName: "", currency: "USD", issueDate: new Date().toISOString().split("T")[0], dueDate: "", notes: "" });
      setLineItems([{ description: "", quantity: 1, unitPrice: 0, accountId: "", taxRate: 10 }]);
      loadInvoices();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/invoices/${id}/status`, { status: newStatus });
      loadInvoices();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const markPaid = async (id: string, total: number) => {
    try {
      await api.post(`/invoices/${id}/pay`, { paidAmount: total });
      loadInvoices();
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  return (
    <div className="page">
      <h2>Invoices (AR/AP)</h2>

      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">All Invoices</option>
          <option value="receivable">Receivable (AR)</option>
          <option value="payable">Payable (AP)</option>
        </select>
        <button className="btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Invoice"}
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Create Invoice</h3>
          <div className="form-row">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
              <option value="receivable">Receivable (Invoice to Customer)</option>
              <option value="payable">Payable (Bill from Vendor)</option>
            </select>
          </div>
          <div className="form-row">
            <label>Counterparty Name</label>
            <input value={form.counterpartyName} onChange={(e) => setForm({ ...form, counterpartyName: e.target.value, counterpartyId: e.target.value.toLowerCase().replace(/\s/g, "-") })} />
          </div>
          <div className="form-row">
            <label>Issue Date</label>
            <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Due Date</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>

          <h4>Line Items</h4>
          {lineItems.map((li, idx) => (
            <div key={idx} className="line-item-row">
              <input placeholder="Description" value={li.description} onChange={(e) => updateLineItem(idx, "description", e.target.value)} />
              <input type="number" placeholder="Qty" value={li.quantity} onChange={(e) => updateLineItem(idx, "quantity", parseFloat(e.target.value))} style={{ width: 60 }} />
              <input type="number" placeholder="Price" value={li.unitPrice} onChange={(e) => updateLineItem(idx, "unitPrice", parseFloat(e.target.value))} style={{ width: 80 }} />
              <select value={li.accountId} onChange={(e) => updateLineItem(idx, "accountId", e.target.value)}>
                <option value="">Account</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input type="number" placeholder="Tax%" value={li.taxRate} onChange={(e) => updateLineItem(idx, "taxRate", parseFloat(e.target.value))} style={{ width: 60 }} />
              <button className="btn secondary" onClick={() => removeLineItem(idx)}>×</button>
            </div>
          ))}
          <button className="btn secondary" onClick={addLineItem}>+ Add Line</button>

          <div className="form-row">
            <strong>Total: ${calculateTotal().toFixed(2)}</strong>
          </div>

          <button className="btn" onClick={createInvoice}>Create Invoice</button>
        </div>
      )}

      {status && <p className="status">{status}</p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Type</th>
            <th>Counterparty</th>
            <th>Total</th>
            <th>Issue Date</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.invoiceNumber}</td>
              <td><span className={`badge ${inv.type}`}>{inv.type === "receivable" ? "AR" : "AP"}</span></td>
              <td>{inv.counterpartyName}</td>
              <td>${inv.total.toFixed(2)}</td>
              <td>{inv.issueDate}</td>
              <td>{inv.dueDate}</td>
              <td><span className={`badge ${inv.status}`}>{inv.status}</span></td>
              <td>
                {inv.status === "draft" && <button className="btn small" onClick={() => updateStatus(inv.id, "sent")}>Send</button>}
                {inv.status === "sent" && <button className="btn small" onClick={() => markPaid(inv.id, inv.total)}>Mark Paid</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InvoicesPage;



