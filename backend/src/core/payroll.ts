import { DbStore } from "./store.db";
import { Employee, PayrollRun, PayrollLine, PayrollStatus } from "./types";
import { newId } from "../utils/id";
import { AuditLogService } from "./security/auditLog";
import { LedgerService } from "./ledger";

interface CreatePayrollInput {
  orgId: string;
  period: string;
  currency: string;
  createdBy: string;
}

export class PayrollService {
  constructor(
    private store: DbStore,
    private audit: AuditLogService,
    private ledger: LedgerService
  ) {}

  // ============ EMPLOYEES ============
  addEmployee(emp: Omit<Employee, "id">) {
    const employee: Employee = { ...emp, id: newId() };
    this.store.addEmployee(employee);
    return employee;
  }

  listEmployees(orgId: string) {
    return this.store.listEmployees(orgId);
  }

  getEmployee(id: string) {
    return this.store.getEmployee(id);
  }

  // ============ PAYROLL RUNS ============
  createRun(input: CreatePayrollInput): PayrollRun {
    const employees = this.store.listEmployees(input.orgId).filter((e) => e.isActive);

    const lines: PayrollLine[] = employees.map((emp) => ({
      id: newId(),
      employeeId: emp.id,
      employeeName: emp.name,
      grossPay: emp.baseSalary,
      taxWithholding: 0,
      otherDeductions: 0,
      netPay: emp.baseSalary
    }));

    const run: PayrollRun = {
      id: newId(),
      orgId: input.orgId,
      period: input.period,
      lines,
      totalGross: lines.reduce((s, l) => s + l.grossPay, 0),
      totalTax: 0,
      totalDeductions: 0,
      totalNet: lines.reduce((s, l) => s + l.netPay, 0),
      currency: input.currency,
      status: "draft",
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.store.addPayrollRun(run);
    this.audit.log({
      orgId: input.orgId,
      actorId: input.createdBy,
      action: "create",
      entity: "payroll_run",
      entityId: run.id
    });

    return run;
  }

  get(id: string) {
    return this.store.getPayrollRun(id);
  }

  list(orgId: string) {
    return this.store.listPayrollRuns(orgId);
  }

  calculateTaxes(id: string, taxRate: number, actorId: string): PayrollRun {
    const run = this.store.getPayrollRun(id);
    if (!run) throw new Error("PayrollRun not found");
    if (run.status !== "draft") throw new Error("Can only calculate taxes for draft runs");

    const lines = run.lines.map((l) => {
      const tax = l.grossPay * (taxRate / 100);
      return {
        ...l,
        taxWithholding: tax,
        netPay: l.grossPay - tax - l.otherDeductions
      };
    });

    const updated = this.store.updatePayrollRun(id, {
      lines,
      totalTax: lines.reduce((s, l) => s + l.taxWithholding, 0),
      totalNet: lines.reduce((s, l) => s + l.netPay, 0),
      status: "calculated"
    });

    this.audit.log({
      orgId: run.orgId,
      actorId,
      action: "calculate_taxes",
      entity: "payroll_run",
      entityId: id,
      metadata: { taxRate }
    });

    return updated;
  }

  approve(id: string, actorId: string): PayrollRun {
    const run = this.store.getPayrollRun(id);
    if (!run) throw new Error("PayrollRun not found");
    if (run.status !== "calculated") throw new Error("Can only approve calculated runs");

    const updated = this.store.updatePayrollRun(id, {
      status: "approved",
      approvedBy: actorId,
      approvedAt: new Date().toISOString()
    });

    this.audit.log({
      orgId: run.orgId,
      actorId,
      action: "approve",
      entity: "payroll_run",
      entityId: id
    });

    return updated;
  }

  finalize(id: string, actorId: string): PayrollRun {
    const run = this.store.getPayrollRun(id);
    if (!run) throw new Error("PayrollRun not found");
    if (run.status !== "approved") throw new Error("Can only finalize approved runs");

    // Create journal entries for payroll
    const accounts = this.store.listAccounts(run.orgId);
    const salaryExpenseAccount = accounts.find((a) => a.name.toLowerCase().includes("salary"));
    const taxPayableAccount = accounts.find((a) => a.name.toLowerCase().includes("tax payable"));
    const cashAccount = accounts.find((a) => a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"));

    if (salaryExpenseAccount && cashAccount) {
      const journalLines = [
        {
          id: newId(),
          accountId: salaryExpenseAccount.id,
          debit: run.totalGross,
          credit: 0,
          currency: run.currency,
          description: `Payroll ${run.period} - Gross wages`
        },
        {
          id: newId(),
          accountId: cashAccount.id,
          debit: 0,
          credit: run.totalNet,
          currency: run.currency,
          description: `Payroll ${run.period} - Net pay`
        }
      ];

      if (taxPayableAccount && run.totalTax > 0) {
        journalLines.push({
          id: newId(),
          accountId: taxPayableAccount.id,
          debit: 0,
          credit: run.totalTax,
          currency: run.currency,
          description: `Payroll ${run.period} - Tax withholding`
        });
      }

      this.ledger.draft({
        orgId: run.orgId,
        period: run.period,
        lines: journalLines,
        memo: `Payroll run ${run.period}`,
        createdBy: actorId,
        externalRef: `payroll-${run.id}`
      });
    }

    const updated = this.store.updatePayrollRun(id, {
      status: "finalized",
      finalizedBy: actorId,
      finalizedAt: new Date().toISOString()
    });

    this.audit.log({
      orgId: run.orgId,
      actorId,
      action: "finalize",
      entity: "payroll_run",
      entityId: id
    });

    return updated;
  }

  summary(orgId: string, year: string) {
    const runs = this.store.listPayrollRuns(orgId).filter((r) => r.period.startsWith(year) && r.status === "finalized");

    return {
      totalGross: runs.reduce((s, r) => s + r.totalGross, 0),
      totalTax: runs.reduce((s, r) => s + r.totalTax, 0),
      totalNet: runs.reduce((s, r) => s + r.totalNet, 0),
      runCount: runs.length,
      byPeriod: runs.map((r) => ({
        period: r.period,
        totalGross: r.totalGross,
        totalTax: r.totalTax,
        totalNet: r.totalNet
      }))
    };
  }
}



