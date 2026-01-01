import { useState, useEffect, useRef } from "react";
import { api, safeArray } from "../lib/api";

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

interface ExtractedInvoice {
  vendorName: string;
  vendorAddress?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotal?: number;
  taxAmount?: number;
  total: number;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate?: number;
  }>;
  notes?: string;
  confidence: number;
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

  // OCR State
  const [showOCR, setShowOCR] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInvoices();
    loadAccounts();
  }, [filter]);

  const loadInvoices = async () => {
    try {
      const typeParam = filter === "all" ? "" : `&type=${filter}`;
      const res = await api.get(`/invoices?orgId=demo-org${typeParam}`);
      setInvoices(safeArray(res.data));
    } catch (e: any) {
      console.warn("Failed to load invoices:", e);
      setInvoices([]);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get("/ledger/accounts?orgId=demo-org");
      setAccounts(safeArray(res.data));
    } catch (e) {
      console.warn("Failed to load accounts:", e);
      setAccounts([]);
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

  // OCR Functions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setOcrStatus("Unsupported file type. Please upload JPG, PNG, WebP images, or PDF files.");
      return;
    }

    setOcrLoading(true);
    setOcrStatus("Uploading and scanning invoice...");
    setExtractedData(null);
    setFileUrl("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orgId", "demo-org");
      formData.append("type", "payable"); // Default to bills/payables
      formData.append("autoCreate", "false"); // Don't auto-create, let user review

      const res = await api.post("/invoices/ocr/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        setExtractedData(res.data.extracted);
        setFileUrl(res.data.fileUrl);
        setOcrStatus(`✓ Extracted with ${Math.round((res.data.extracted?.confidence || 0) * 100)}% confidence`);
      } else {
        setOcrStatus(`Error: ${res.data.error}`);
      }
    } catch (e: any) {
      setOcrStatus(`Error: ${e.response?.data?.error || e.message}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const createFromExtracted = async () => {
    if (!extractedData) return;

    setOcrLoading(true);
    setOcrStatus("Creating invoice...");

    try {
      const res = await api.post("/invoices/ocr/create-from-extracted", {
        extracted: extractedData,
        orgId: "demo-org",
        invoiceType: "payable",
        receiptUrl: fileUrl
      });

      if (res.data.success) {
        setOcrStatus("✓ Invoice created!");
        setExtractedData(null);
        setFileUrl("");
        setShowOCR(false);
        loadInvoices();
      } else {
        setOcrStatus(`Error: ${res.data.error}`);
      }
    } catch (e: any) {
      setOcrStatus(`Error: ${e.response?.data?.error || e.message}`);
    } finally {
      setOcrLoading(false);
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
        <button 
          className="btn secondary" 
          onClick={() => { setShowOCR(!showOCR); setShowForm(false); }}
        >
          📷 Scan Invoice
        </button>
      </div>

      {/* OCR Upload Section */}
      {showOCR && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <h3>📷 Scan Invoice / Receipt</h3>
          <p className="muted">Upload an image of an invoice or receipt to automatically extract data.</p>
          
          <div
            className={`drop-zone ${dragActive ? "active" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8,
              padding: 40,
              textAlign: "center",
              cursor: "pointer",
              background: dragActive ? "var(--bg-secondary)" : "transparent",
              transition: "all 0.2s"
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 48, marginBottom: 8 }}>📄</div>
            <p style={{ margin: 0 }}>
              {ocrLoading ? "Processing..." : "Drop image here or click to upload"}
            </p>
            <p className="muted" style={{ fontSize: "0.85em", marginTop: 4 }}>
              Supports: JPG, PNG, WebP (max 10MB)
            </p>
          </div>

          {ocrStatus && (
            <p className="status" style={{ marginTop: 12 }}>{ocrStatus}</p>
          )}

          {extractedData && (
            <div style={{ marginTop: 20, padding: 16, background: "var(--bg-secondary)", borderRadius: 8 }}>
              <h4 style={{ marginTop: 0 }}>Extracted Data</h4>
              <table style={{ width: "100%", fontSize: "0.9em" }}>
                <tbody>
                  <tr><td style={{ fontWeight: 500, width: 120 }}>Vendor</td><td>{extractedData.vendorName}</td></tr>
                  {extractedData.invoiceNumber && <tr><td style={{ fontWeight: 500 }}>Invoice #</td><td>{extractedData.invoiceNumber}</td></tr>}
                  {extractedData.invoiceDate && <tr><td style={{ fontWeight: 500 }}>Date</td><td>{extractedData.invoiceDate}</td></tr>}
                  {extractedData.dueDate && <tr><td style={{ fontWeight: 500 }}>Due Date</td><td>{extractedData.dueDate}</td></tr>}
                  <tr><td style={{ fontWeight: 500 }}>Subtotal</td><td>{extractedData.subtotal?.toFixed(2)} {extractedData.currency}</td></tr>
                  <tr><td style={{ fontWeight: 500 }}>Tax</td><td>{extractedData.taxAmount?.toFixed(2)} {extractedData.currency}</td></tr>
                  <tr><td style={{ fontWeight: 500 }}>Total</td><td style={{ fontWeight: 600, fontSize: "1.1em" }}>{extractedData.total.toFixed(2)} {extractedData.currency}</td></tr>
                </tbody>
              </table>
              
              {extractedData.lineItems.length > 0 && (
                <>
                  <h5 style={{ marginBottom: 8 }}>Line Items ({extractedData.lineItems.length})</h5>
                  <table style={{ width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedData.lineItems.slice(0, 5).map((li, i) => (
                        <tr key={i}>
                          <td>{li.description.slice(0, 40)}{li.description.length > 40 ? "..." : ""}</td>
                          <td>{li.quantity}</td>
                          <td>{li.unitPrice.toFixed(2)}</td>
                          <td>{li.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                <button className="btn" onClick={createFromExtracted} disabled={ocrLoading}>
                  ✓ Create Invoice
                </button>
                <button className="btn secondary" onClick={() => { setExtractedData(null); setOcrStatus(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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



