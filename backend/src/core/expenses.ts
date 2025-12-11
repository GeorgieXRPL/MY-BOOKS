import { DbStore } from "./store.db";
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
  constructor(private store: DbStore, private audit: AuditLogService) {}

  create(input: CreateExpenseInput): Expense {
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

    this.store.addExpense(expense);
    this.audit.log({
      orgId: input.orgId,
      actorId: input.createdBy,
      action: "create",
      entity: "expense",
      entityId: expense.id,
      after: expense as any
    });

    return expense;
  }

  get(id: string) {
    return this.store.getExpense(id);
  }

  list(orgId: string, filters?: { status?: ExpenseStatus; category?: string }) {
    let expenses = this.store.listExpenses(orgId);
    if (filters?.status) {
      expenses = expenses.filter((e) => e.status === filters.status);
    }
    if (filters?.category) {
      expenses = expenses.filter((e) => e.category === filters.category);
    }
    return expenses;
  }

  submit(id: string, actorId: string) {
    const expense = this.store.getExpense(id);
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "draft") throw new Error("Can only submit draft expenses");

    const updated = this.store.updateExpense(id, { status: "submitted" });
    this.audit.log({
      orgId: expense.orgId,
      actorId,
      action: "submit",
      entity: "expense",
      entityId: id
    });
    return updated;
  }

  approve(id: string, actorId: string) {
    const expense = this.store.getExpense(id);
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "submitted") throw new Error("Can only approve submitted expenses");

    const updated = this.store.updateExpense(id, {
      status: "approved",
      approvedBy: actorId,
      approvedAt: new Date().toISOString()
    });

    this.audit.log({
      orgId: expense.orgId,
      actorId,
      action: "approve",
      entity: "expense",
      entityId: id
    });
    return updated;
  }

  reject(id: string, actorId: string) {
    const expense = this.store.getExpense(id);
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "submitted") throw new Error("Can only reject submitted expenses");

    const updated = this.store.updateExpense(id, { status: "rejected" });
    this.audit.log({
      orgId: expense.orgId,
      actorId,
      action: "reject",
      entity: "expense",
      entityId: id
    });
    return updated;
  }

  markPaid(id: string, actorId: string) {
    const expense = this.store.getExpense(id);
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "approved") throw new Error("Can only pay approved expenses");

    const updated = this.store.updateExpense(id, { status: "paid" });
    this.audit.log({
      orgId: expense.orgId,
      actorId,
      action: "mark_paid",
      entity: "expense",
      entityId: id
    });
    return updated;
  }

  categoryBreakdown(orgId: string, startDate?: string, endDate?: string) {
    let expenses = this.store.listExpenses(orgId);
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



