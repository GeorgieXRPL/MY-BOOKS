import { IStore } from "./store.interface";
import { Expense, ExpenseStatus } from "./types";
import { newId } from "../utils/id";
import { AuditLogService } from "./security/auditLog";

interface CreateExpenseInput {
  orgId: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  receiptUrl?: string;
  reimbursable: boolean;
  paidBy: string;
  accountId: string;
  taxAmount: number;
  createdBy: string;
}

export class ExpenseService {
  constructor(private store: IStore, private audit: AuditLogService) {}

  async create(input: CreateExpenseInput): Promise<Expense> {
    const expense: Expense = {
      id: newId(),
      orgId: input.orgId,
      category: input.category,
      vendor: input.vendor,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      date: input.date,
      receiptUrl: input.receiptUrl,
      reimbursable: input.reimbursable,
      status: "draft",
      paidBy: input.paidBy,
      accountId: input.accountId,
      taxAmount: input.taxAmount,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await Promise.resolve(this.store.addExpense(expense));
    await this.audit.log({
      orgId: input.orgId,
      actorId: input.createdBy,
      action: "create",
      entity: "expense",
      entityId: expense.id,
      after: expense as any
    });

    return expense;
  }

  async get(id: string): Promise<Expense | undefined> {
    return Promise.resolve(this.store.getExpense(id));
  }

  async list(orgId: string, filters?: { status?: ExpenseStatus; category?: string }): Promise<Expense[]> {
    let expenses = await Promise.resolve(this.store.listExpenses(orgId));
    if (filters?.status) {
      expenses = expenses.filter((e) => e.status === filters.status);
    }
    if (filters?.category) {
      expenses = expenses.filter((e) => e.category === filters.category);
    }
    return expenses;
  }

  async submit(id: string, actorId: string): Promise<Expense> {
    const expense = await Promise.resolve(this.store.getExpense(id));
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "draft") throw new Error("Can only submit draft expenses");

    await Promise.resolve(this.store.updateExpense(id, { status: "submitted" }));
    const updated = await Promise.resolve(this.store.getExpense(id));
    await this.audit.log({
      orgId: expense.orgId,
      actorId,
      action: "submit",
      entity: "expense",
      entityId: id
    });
    return updated!;
  }

  async approve(id: string, actorId: string): Promise<Expense> {
    const expense = await Promise.resolve(this.store.getExpense(id));
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "submitted") throw new Error("Can only approve submitted expenses");

    await Promise.resolve(this.store.updateExpense(id, {
      status: "approved",
      approvedBy: actorId,
      approvedAt: new Date().toISOString()
    }));
    const updated = await Promise.resolve(this.store.getExpense(id));

    await this.audit.log({
      orgId: expense.orgId,
      actorId,
      action: "approve",
      entity: "expense",
      entityId: id
    });
    return updated!;
  }

  async reject(id: string, actorId: string): Promise<Expense> {
    const expense = await Promise.resolve(this.store.getExpense(id));
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "submitted") throw new Error("Can only reject submitted expenses");

    await Promise.resolve(this.store.updateExpense(id, { status: "rejected" }));
    const updated = await Promise.resolve(this.store.getExpense(id));
    await this.audit.log({
      orgId: expense.orgId,
      actorId,
      action: "reject",
      entity: "expense",
      entityId: id
    });
    return updated!;
  }

  async markPaid(id: string, actorId: string): Promise<Expense> {
    const expense = await Promise.resolve(this.store.getExpense(id));
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "approved") throw new Error("Can only pay approved expenses");

    await Promise.resolve(this.store.updateExpense(id, { status: "paid" }));
    const updated = await Promise.resolve(this.store.getExpense(id));
    await this.audit.log({
      orgId: expense.orgId,
      actorId,
      action: "mark_paid",
      entity: "expense",
      entityId: id
    });
    return updated!;
  }

  async categoryBreakdown(orgId: string, startDate?: string, endDate?: string) {
    let expenses = await Promise.resolve(this.store.listExpenses(orgId));
    if (startDate) {
      expenses = expenses.filter((e) => e.date >= startDate);
    }
    if (endDate) {
      expenses = expenses.filter((e) => e.date <= endDate);
    }

    const breakdown: Record<string, { count: number; total: number }> = {};
    for (const exp of expenses) {
      if (!breakdown[exp.category]) {
        breakdown[exp.category] = { count: 0, total: 0 };
      }
      breakdown[exp.category].count++;
      breakdown[exp.category].total += exp.amount;
    }

    return breakdown;
  }
}



