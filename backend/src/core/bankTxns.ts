import { IStore } from "./store.interface";
import { BankTransaction, BankTxnStatus } from "./types";
import { newId } from "../utils/id";
import { AuditLogService } from "./security/auditLog";

interface CreateBankTxnInput {
  orgId: string;
  bankAccountId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: "debit" | "credit";
  externalRef?: string;
}

interface CsvRow {
  date: string;
  description: string;
  amount: string;
  type?: string;
}

export class BankTxnService {
  constructor(private store: IStore, private audit: AuditLogService) {}

  async create(input: CreateBankTxnInput): Promise<BankTransaction> {
    const txn: BankTransaction = {
      id: newId(),
      orgId: input.orgId,
      bankAccountId: input.bankAccountId,
      date: input.date,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      type: input.type,
      status: "uncategorized",
      externalRef: input.externalRef,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await Promise.resolve(this.store.addBankTransaction(txn));
    return txn;
  }

  async get(id: string): Promise<BankTransaction | undefined> {
    return Promise.resolve(this.store.getBankTransaction(id));
  }

  async list(orgId: string, filters?: { status?: BankTxnStatus; bankAccountId?: string }): Promise<BankTransaction[]> {
    let txns = await Promise.resolve(this.store.listBankTransactions(orgId));
    if (filters?.status) {
      txns = txns.filter((t) => t.status === filters.status);
    }
    if (filters?.bankAccountId) {
      txns = txns.filter((t) => t.bankAccountId === filters.bankAccountId);
    }
    return txns;
  }

  async categorize(id: string, category: string, accountId: string, actorId: string): Promise<BankTransaction> {
    const txn = await Promise.resolve(this.store.getBankTransaction(id));
    if (!txn) throw new Error("BankTransaction not found");

    await Promise.resolve(this.store.updateBankTransaction(id, {
      category,
      accountId,
      status: "categorized"
    }));
    const updated = await Promise.resolve(this.store.getBankTransaction(id));

    await this.audit.log({
      orgId: txn.orgId,
      actorId,
      action: "categorize",
      entity: "bank_transaction",
      entityId: id,
      after: { category, accountId }
    });

    return updated!;
  }

  async markReconciled(id: string, actorId: string): Promise<BankTransaction> {
    const txn = await Promise.resolve(this.store.getBankTransaction(id));
    if (!txn) throw new Error("BankTransaction not found");

    await Promise.resolve(this.store.updateBankTransaction(id, { status: "reconciled" }));
    const updated = await Promise.resolve(this.store.getBankTransaction(id));
    await this.audit.log({
      orgId: txn.orgId,
      actorId,
      action: "mark_reconciled",
      entity: "bank_transaction",
      entityId: id
    });

    return updated!;
  }

  async bulkImportCsv(orgId: string, bankAccountId: string, currency: string, rows: CsvRow[]): Promise<BankTransaction[]> {
    const created: BankTransaction[] = [];

    for (const row of rows) {
      const amount = parseFloat(row.amount.replace(/[^0-9.-]/g, ""));
      if (isNaN(amount)) continue;

      const type = row.type
        ? (row.type.toLowerCase() as "debit" | "credit")
        : amount < 0
          ? "debit"
          : "credit";

      const txn = await this.create({
        orgId,
        bankAccountId,
        date: row.date,
        description: row.description,
        amount: Math.abs(amount),
        currency,
        type
      });
      created.push(txn);
    }

    return created;
  }

  async splitTransaction(id: string, splits: { amount: number; category: string; accountId: string }[], actorId: string): Promise<BankTransaction[]> {
    const txn = await Promise.resolve(this.store.getBankTransaction(id));
    if (!txn) throw new Error("BankTransaction not found");

    const totalSplit = splits.reduce((s, sp) => s + sp.amount, 0);
    if (Math.abs(totalSplit - txn.amount) > 0.01) {
      throw new Error("Split amounts must equal transaction amount");
    }

    const created: BankTransaction[] = [];
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const newTxn: BankTransaction = {
        id: newId(),
        orgId: txn.orgId,
        bankAccountId: txn.bankAccountId,
        date: txn.date,
        description: `${txn.description} (split ${i + 1})`,
        amount: split.amount,
        currency: txn.currency,
        type: txn.type,
        category: split.category,
        accountId: split.accountId,
        status: "categorized",
        externalRef: txn.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await Promise.resolve(this.store.addBankTransaction(newTxn));
      created.push(newTxn);
    }

    // Mark original as reconciled (it's been split)
    await Promise.resolve(this.store.updateBankTransaction(id, { status: "reconciled" }));

    await this.audit.log({
      orgId: txn.orgId,
      actorId,
      action: "split",
      entity: "bank_transaction",
      entityId: id,
      metadata: { splitCount: splits.length }
    });

    return created;
  }

  async summary(orgId: string, startDate?: string, endDate?: string) {
    let txns = await Promise.resolve(this.store.listBankTransactions(orgId));
    if (startDate) txns = txns.filter((t) => t.date >= startDate);
    if (endDate) txns = txns.filter((t) => t.date <= endDate);

    const debits = txns.filter((t) => t.type === "debit");
    const credits = txns.filter((t) => t.type === "credit");

    return {
      totalDebits: debits.reduce((s, t) => s + t.amount, 0),
      totalCredits: credits.reduce((s, t) => s + t.amount, 0),
      netChange: credits.reduce((s, t) => s + t.amount, 0) - debits.reduce((s, t) => s + t.amount, 0),
      uncategorized: txns.filter((t) => t.status === "uncategorized").length,
      categorized: txns.filter((t) => t.status === "categorized").length,
      reconciled: txns.filter((t) => t.status === "reconciled").length
    };
  }
}



