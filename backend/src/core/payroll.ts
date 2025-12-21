import { IStore } from "./store.interface";
import { Employee, PayrollRun, PayrollLine, PayrollStatus, Account } from "./types";
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
    private store: IStore,
    private audit: AuditLogService,
    private ledger: LedgerService
  ) {}

  // ============ EMPLOYEES ============
  async addEmployee(emp: Omit<Employee, "id">): Promise<Employee> {
    const employee: Employee = { ...emp, id: newId() };
    await Promise.resolve(this.store.addEmployee(employee));
    return employee;
  }

  async listEmployees(orgId: string): Promise<Employee[]> {
    return Promise.resolve(this.store.listEmployees(orgId));
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    return Promise.resolve(this.store.getEmployee(id));
  }

  // ============ PAYROLL RUNS ============
  async createRun(input: CreatePayrollInput): Promise<PayrollRun> {
    const allEmployees = await Promise.resolve(this.store.listEmployees(input.orgId));
    const employees = allEmployees.filter((e) => e.isActive);

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

    await Promise.resolve(this.store.addPayrollRun(run));
    await this.audit.log({
      orgId: input.orgId,
      actorId: input.createdBy,
      action: "create",
      entity: "payroll_run",
      entityId: run.id
    });

    return run;
  }

  async get(id: string): Promise<PayrollRun | undefined> {
    return Promise.resolve(this.store.getPayrollRun(id));
  }

  async list(orgId: string): Promise<PayrollRun[]> {
    return Promise.resolve(this.store.listPayrollRuns(orgId));
  }

  async calculateTaxes(id: string, taxRate: number, actorId: string): Promise<PayrollRun> {
    const run = await Promise.resolve(this.store.getPayrollRun(id));
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

    await Promise.resolve(this.store.updatePayrollRun(id, {
      lines,
      totalTax: lines.reduce((s, l) => s + l.taxWithholding, 0),
      totalNet: lines.reduce((s, l) => s + l.netPay, 0),
      status: "calculated"
    }));
    const updated = await Promise.resolve(this.store.getPayrollRun(id));

    await this.audit.log({
      orgId: run.orgId,
      actorId,
      action: "calculate_taxes",
      entity: "payroll_run",
      entityId: id,
      metadata: { taxRate }
    });

    return updated!;
  }

  async approve(id: string, actorId: string): Promise<PayrollRun> {
    const run = await Promise.resolve(this.store.getPayrollRun(id));
    if (!run) throw new Error("PayrollRun not found");
    if (run.status !== "calculated") throw new Error("Can only approve calculated runs");

    await Promise.resolve(this.store.updatePayrollRun(id, {
      status: "approved",
      approvedBy: actorId,
      approvedAt: new Date().toISOString()
    }));
    const updated = await Promise.resolve(this.store.getPayrollRun(id));

    await this.audit.log({
      orgId: run.orgId,
      actorId,
      action: "approve",
      entity: "payroll_run",
      entityId: id
    });

    return updated!;
  }

  async finalize(id: string, actorId: string): Promise<PayrollRun> {
    const run = await Promise.resolve(this.store.getPayrollRun(id));
    if (!run) throw new Error("PayrollRun not found");
    if (run.status !== "approved") throw new Error("Can only finalize approved runs");

    // Create journal entries for payroll
    const accounts = await Promise.resolve(this.store.listAccounts(run.orgId));
    const salaryExpenseAccount = accounts.find((a: Account) => a.name.toLowerCase().includes("salary"));
    const taxPayableAccount = accounts.find((a: Account) => a.name.toLowerCase().includes("tax payable"));
    const cashAccount = accounts.find((a: Account) => a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"));

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

      await this.ledger.draft({
        orgId: run.orgId,
        period: run.period,
        lines: journalLines,
        memo: `Payroll run ${run.period}`,
        createdBy: actorId,
        externalRef: `payroll-${run.id}`
      });
    }

    await Promise.resolve(this.store.updatePayrollRun(id, {
      status: "finalized",
      finalizedBy: actorId,
      finalizedAt: new Date().toISOString()
    }));
    const updated = await Promise.resolve(this.store.getPayrollRun(id));

    await this.audit.log({
      orgId: run.orgId,
      actorId,
      action: "finalize",
      entity: "payroll_run",
      entityId: id
    });

    return updated!;
  }

  async summary(orgId: string, year: string) {
    const allRuns = await Promise.resolve(this.store.listPayrollRuns(orgId));
    const runs = allRuns.filter((r) => r.period.startsWith(year) && r.status === "finalized");

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



