import { IStore } from "./store.interface";
import { Invoice, InvoiceLineItem, InvoiceStatus, InvoiceType } from "./types";
import { newId } from "../utils/id";
import { AuditLogService } from "./security/auditLog";

interface CreateInvoiceInput {
  orgId: string;
  type: InvoiceType;
  counterpartyId: string;
  counterpartyName: string;
  lineItems: Omit<InvoiceLineItem, "id">[];
  currency: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  createdBy: string;
}

export class InvoiceService {
  constructor(private store: IStore, private audit: AuditLogService) {}

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const lineItems: InvoiceLineItem[] = input.lineItems.map((li) => ({
      ...li,
      id: newId(),
      amount: li.quantity * li.unitPrice * (1 + li.taxRate / 100)
    }));

    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
    const taxAmount = lineItems.reduce(
      (sum, li) => sum + li.quantity * li.unitPrice * (li.taxRate / 100),
      0
    );
    const total = subtotal + taxAmount;

    const invoiceNumber = await Promise.resolve(this.store.nextInvoiceNumber(input.orgId, input.type));

    const invoice: Invoice = {
      id: newId(),
      orgId: input.orgId,
      invoiceNumber,
      type: input.type,
      counterpartyId: input.counterpartyId,
      counterpartyName: input.counterpartyName,
      lineItems,
      subtotal,
      taxAmount,
      total,
      currency: input.currency,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: "draft",
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await Promise.resolve(this.store.addInvoice(invoice));
    await this.audit.log({
      orgId: input.orgId,
      actorId: input.createdBy,
      action: "create",
      entity: "invoice",
      entityId: invoice.id,
      after: invoice as any
    });

    return invoice;
  }

  async get(id: string): Promise<Invoice | undefined> {
    return Promise.resolve(this.store.getInvoice(id));
  }

  async list(orgId: string, filters?: { type?: InvoiceType; status?: InvoiceStatus }): Promise<Invoice[]> {
    let invoices = await Promise.resolve(this.store.listInvoices(orgId));
    if (filters?.type) {
      invoices = invoices.filter((i) => i.type === filters.type);
    }
    if (filters?.status) {
      invoices = invoices.filter((i) => i.status === filters.status);
    }
    return invoices;
  }

  async updateStatus(id: string, status: InvoiceStatus, actorId: string): Promise<Invoice> {
    const invoice = await Promise.resolve(this.store.getInvoice(id));
    if (!invoice) throw new Error("Invoice not found");

    const patch: Partial<Invoice> = { status };
    if (status === "paid") {
      patch.paidDate = new Date().toISOString();
      patch.paidAmount = invoice.total;
    }

    await Promise.resolve(this.store.updateInvoice(id, patch));
    const updated = await Promise.resolve(this.store.getInvoice(id));
    await this.audit.log({
      orgId: invoice.orgId,
      actorId,
      action: "update_status",
      entity: "invoice",
      entityId: id,
      before: { status: invoice.status },
      after: { status }
    });

    return updated!;
  }

  async markPaid(id: string, paidAmount: number, actorId: string): Promise<Invoice> {
    const invoice = await Promise.resolve(this.store.getInvoice(id));
    if (!invoice) throw new Error("Invoice not found");

    await Promise.resolve(this.store.updateInvoice(id, {
      status: "paid",
      paidDate: new Date().toISOString(),
      paidAmount
    }));
    const updated = await Promise.resolve(this.store.getInvoice(id));

    await this.audit.log({
      orgId: invoice.orgId,
      actorId,
      action: "mark_paid",
      entity: "invoice",
      entityId: id,
      after: { paidAmount }
    });

    return updated!;
  }

  async agingReport(orgId: string, type: InvoiceType) {
    const allInvoices = await Promise.resolve(this.store.listInvoices(orgId));
    const invoices = allInvoices.filter(
      (i) => i.type === type && i.status !== "paid" && i.status !== "cancelled"
    );

    const today = new Date();
    const buckets = {
      current: [] as Invoice[],
      days1to30: [] as Invoice[],
      days31to60: [] as Invoice[],
      days61to90: [] as Invoice[],
      over90: [] as Invoice[]
    };

    for (const inv of invoices) {
      const due = new Date(inv.dueDate);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) buckets.current.push(inv);
      else if (daysOverdue <= 30) buckets.days1to30.push(inv);
      else if (daysOverdue <= 60) buckets.days31to60.push(inv);
      else if (daysOverdue <= 90) buckets.days61to90.push(inv);
      else buckets.over90.push(inv);
    }

    const sumTotal = (arr: Invoice[]) => arr.reduce((s, i) => s + i.total, 0);

    return {
      buckets,
      totals: {
        current: sumTotal(buckets.current),
        days1to30: sumTotal(buckets.days1to30),
        days31to60: sumTotal(buckets.days31to60),
        days61to90: sumTotal(buckets.days61to90),
        over90: sumTotal(buckets.over90),
        total: sumTotal(invoices)
      }
    };
  }
}



