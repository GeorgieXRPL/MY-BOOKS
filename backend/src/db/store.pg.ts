import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc, isNull, lt, sql } from "drizzle-orm";
import * as schema from "./schema";
import { buildDefaultCoa } from "../core/coa";
import { newId } from "../utils/id";
import { logger } from "../utils/logger";
import dns from "dns";
import { promisify } from "util";
import {
  Account, Wallet, JournalEntry, JournalLine, PriceTick, FXRate,
  ReconciliationItem, AuditLogEntry, PeriodLock, ChecklistItem, Role,
  TreasuryPolicy, Invoice, InvoiceLineItem, Expense, Employee, PayrollRun,
  PayrollLine, BankTransaction, CryptoTransaction, CryptoLot, Asset,
  DepreciationEntry, TaxRate, Formula, Counterparty
} from "../core/types";

const dnsLookup = promisify(dns.lookup);

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export class PgStore {
  private pool!: Pool;
  private db!: DrizzleDb;
  private connectionString: string;

  constructor(connectionString: string, private seedOrgId: string, private seedCurrency: string) {
    this.connectionString = connectionString;
  }
  
  // Initialize with IPv4 resolution (must be called before using the store)
  async initConnection(): Promise<void> {
    // Parse connection string and resolve hostname to IPv4
    const url = new URL(this.connectionString);
    const hostname = url.hostname;
    const port = parseInt(url.port) || 5432;
    const database = url.pathname.slice(1);
    const user = url.username;
    const password = decodeURIComponent(url.password);
    
    // Resolve hostname to IPv4 to avoid IPv6 issues on Render
    let resolvedHost = hostname;
    try {
      const result = await dnsLookup(hostname, { family: 4 });
      resolvedHost = result.address;
      logger.info(`Resolved ${hostname} to ${resolvedHost} (IPv4)`);
    } catch (error) {
      logger.warn(`Failed to resolve ${hostname} to IPv4, using original hostname`);
    }
    
    this.pool = new Pool({
      host: resolvedHost,
      port,
      database,
      user,
      password,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    this.db = drizzle(this.pool, { schema });
    logger.info(`PgStore connected to ${resolvedHost}:${port}/${database}`);
  }

  async initialize() {
    // Seed COA if empty
    const accounts = await this.db.select().from(schema.accounts).where(eq(schema.accounts.orgId, this.seedOrgId));
    if (accounts.length === 0) {
      const coa = buildDefaultCoa(this.seedOrgId, this.seedCurrency);
      for (const acc of coa) {
        await this.db.insert(schema.accounts).values({
          id: acc.id,
          orgId: acc.orgId,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          currency: acc.currency,
          isActive: acc.isActive ?? true
        });
      }
      logger.info(`Seeded ${coa.length} accounts for org ${this.seedOrgId}`);
    }
  }

  async close() {
    await this.pool.end();
  }

  // ============ ACCOUNTS ============
  async upsertAccount(account: Account) {
    await this.db.insert(schema.accounts).values({
      id: account.id,
      orgId: account.orgId,
      code: account.code,
      name: account.name,
      type: account.type,
      currency: account.currency,
      tags: account.tags ? JSON.stringify(account.tags) : null,
      metadata: account.metadata ? JSON.stringify(account.metadata) : null,
      isActive: account.isActive ?? true
    }).onConflictDoUpdate({
      target: schema.accounts.id,
      set: {
        code: account.code,
        name: account.name,
        type: account.type,
        currency: account.currency,
        tags: account.tags ? JSON.stringify(account.tags) : null,
        metadata: account.metadata ? JSON.stringify(account.metadata) : null,
        isActive: account.isActive ?? true
      }
    });
    return account;
  }

  async listAccounts(orgId: string): Promise<Account[]> {
    const rows = await this.db.select().from(schema.accounts).where(eq(schema.accounts.orgId, orgId));
    return rows.map(r => ({
      id: r.id,
      orgId: r.orgId,
      code: r.code,
      name: r.name,
      type: r.type as any,
      currency: r.currency,
      tags: r.tags ? JSON.parse(r.tags) : undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      isActive: r.isActive ?? true
    }));
  }

  // ============ WALLETS ============
  async addWallet(wallet: Wallet) {
    await this.db.insert(schema.wallets).values({
      id: wallet.id,
      orgId: wallet.orgId,
      address: wallet.address,
      chain: wallet.chain,
      label: wallet.label,
      purpose: wallet.purpose,
      currency: wallet.currency
    }).onConflictDoUpdate({
      target: schema.wallets.id,
      set: wallet
    });
    return wallet;
  }

  async listWallets(orgId: string): Promise<Wallet[]> {
    const rows = await this.db.select().from(schema.wallets).where(eq(schema.wallets.orgId, orgId));
    return rows as Wallet[];
  }

  // ============ JOURNALS ============
  async addJournal(journal: JournalEntry) {
    // Insert journal
    await this.db.insert(schema.journals).values({
      id: journal.id,
      orgId: journal.orgId,
      status: journal.status,
      period: journal.period,
      createdBy: journal.createdBy,
      reviewedBy: journal.reviewedBy,
      postedBy: journal.postedBy,
      memo: journal.memo,
      tags: journal.tags ? JSON.stringify(journal.tags) : null,
      createdAt: journal.createdAt,
      updatedAt: journal.updatedAt,
      externalRef: journal.externalRef
    }).onConflictDoUpdate({
      target: schema.journals.id,
      set: {
        status: journal.status,
        reviewedBy: journal.reviewedBy,
        postedBy: journal.postedBy,
        memo: journal.memo,
        tags: journal.tags ? JSON.stringify(journal.tags) : null,
        updatedAt: journal.updatedAt
      }
    });

    // Delete existing lines and insert new ones
    await this.db.delete(schema.journalLines).where(eq(schema.journalLines.journalId, journal.id));
    for (const line of journal.lines) {
      await this.db.insert(schema.journalLines).values({
        id: line.id,
        journalId: journal.id,
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        currency: line.currency,
        description: line.description,
        walletId: line.walletId,
        tokenSymbol: line.tokenSymbol,
        fxRate: line.fxRate,
        externalRef: line.externalRef,
        txHash: line.txHash
      });
    }
    return journal;
  }

  async getJournal(id: string): Promise<JournalEntry | undefined> {
    const rows = await this.db.select().from(schema.journals).where(eq(schema.journals.id, id));
    if (rows.length === 0) return undefined;
    const journal = rows[0];
    const lines = await this.db.select().from(schema.journalLines).where(eq(schema.journalLines.journalId, id));
    return {
      ...journal,
      tags: journal.tags ? JSON.parse(journal.tags) : undefined,
      lines: lines as JournalLine[]
    } as JournalEntry;
  }

  async updateJournal(id: string, patch: Partial<JournalEntry>) {
    const existing = await this.getJournal(id);
    if (!existing) throw new Error("Journal not found");
    const updated: JournalEntry = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    await this.addJournal(updated);
    return updated;
  }

  async listJournals(orgId: string): Promise<JournalEntry[]> {
    const rows = await this.db.select().from(schema.journals).where(eq(schema.journals.orgId, orgId));
    const results: JournalEntry[] = [];
    for (const row of rows) {
      const lines = await this.db.select().from(schema.journalLines).where(eq(schema.journalLines.journalId, row.id));
      results.push({
        ...row,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        lines: lines as JournalLine[]
      } as JournalEntry);
    }
    return results;
  }

  // ============ PRICE TICKS ============
  async addPriceTick(price: Omit<PriceTick, "id">): Promise<PriceTick> {
    const tick = { ...price, id: newId() };
    await this.db.insert(schema.priceTicks).values(tick);
    return tick;
  }

  async latestPrice(symbol: string, currency: string): Promise<PriceTick | undefined> {
    const rows = await this.db.select().from(schema.priceTicks)
      .where(and(eq(schema.priceTicks.symbol, symbol), eq(schema.priceTicks.currency, currency)))
      .orderBy(desc(schema.priceTicks.timestamp))
      .limit(1);
    return rows[0] as PriceTick | undefined;
  }

  // ============ FX RATES ============
  async addFxRate(rate: Omit<FXRate, "id">): Promise<FXRate> {
    const fx = { ...rate, id: newId() };
    await this.db.insert(schema.fxRates).values(fx);
    return fx;
  }

  // ============ RECONCILIATIONS ============
  async addReconciliation(rec: Omit<ReconciliationItem, "id" | "createdAt">): Promise<ReconciliationItem> {
    const item: ReconciliationItem = { ...rec, id: newId(), createdAt: new Date().toISOString() };
    await this.db.insert(schema.reconciliations).values({
      id: item.id,
      orgId: item.orgId,
      source: item.source,
      externalRef: item.externalRef,
      externalBalance: item.externalBalance,
      ledgerBalance: item.ledgerBalance,
      delta: item.delta,
      status: item.status,
      note: item.note,
      createdAt: item.createdAt
    });
    return item;
  }

  async listReconciliations(orgId: string): Promise<ReconciliationItem[]> {
    const rows = await this.db.select().from(schema.reconciliations).where(eq(schema.reconciliations.orgId, orgId));
    return rows as ReconciliationItem[];
  }

  // ============ AUDIT LOGS ============
  async addAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<AuditLogEntry> {
    const log: AuditLogEntry = { ...entry, id: newId(), timestamp: new Date().toISOString() };
    await this.db.insert(schema.auditLogs).values({
      id: log.id,
      orgId: log.orgId,
      actorId: log.actorId,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      before: log.before ? JSON.stringify(log.before) : null,
      after: log.after ? JSON.stringify(log.after) : null,
      timestamp: log.timestamp,
      metadata: log.metadata ? JSON.stringify(log.metadata) : null
    });
    return log;
  }

  async listAudit(orgId: string): Promise<AuditLogEntry[]> {
    const rows = await this.db.select().from(schema.auditLogs)
      .where(eq(schema.auditLogs.orgId, orgId))
      .orderBy(desc(schema.auditLogs.timestamp));
    return rows.map(r => ({
      ...r,
      before: r.before ? JSON.parse(r.before) : undefined,
      after: r.after ? JSON.parse(r.after) : undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined
    })) as AuditLogEntry[];
  }

  // ============ PERIOD LOCKS ============
  async lockPeriod(lock: PeriodLock) {
    await this.db.insert(schema.periodLocks).values({
      orgId: lock.orgId,
      period: lock.period,
      lockedBy: lock.lockedBy,
      lockedAt: lock.lockedAt
    });
  }

  async isPeriodLocked(orgId: string, period: string): Promise<boolean> {
    const rows = await this.db.select().from(schema.periodLocks)
      .where(and(eq(schema.periodLocks.orgId, orgId), eq(schema.periodLocks.period, period)))
      .limit(1);
    return rows.length > 0;
  }

  // ============ ROLES ============
  async upsertRole(userId: string, roles: Role[]) {
    await this.db.insert(schema.roles).values({
      userId,
      roles: JSON.stringify(roles)
    }).onConflictDoUpdate({
      target: schema.roles.userId,
      set: { roles: JSON.stringify(roles) }
    });
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const rows = await this.db.select().from(schema.roles).where(eq(schema.roles.userId, userId));
    if (rows.length === 0) return [];
    try {
      return JSON.parse(rows[0].roles) as Role[];
    } catch {
      return [];
    }
  }

  // ============ POLICIES ============
  async setPolicy(orgId: string, policy: TreasuryPolicy) {
    await this.db.insert(schema.policies).values({
      orgId,
      maxSingleSpend: policy.maxSingleSpend,
      largeTxAlertThreshold: policy.largeTxAlertThreshold,
      minSignerQuorum: policy.minSignerQuorum
    }).onConflictDoUpdate({
      target: schema.policies.orgId,
      set: policy
    });
  }

  async getPolicy(orgId: string): Promise<TreasuryPolicy | undefined> {
    const rows = await this.db.select().from(schema.policies).where(eq(schema.policies.orgId, orgId));
    return rows[0] as TreasuryPolicy | undefined;
  }

  // ============ CHECKLIST ============
  checklist = {
    push: async (...items: ChecklistItem[]) => {
      for (const item of items) {
        await this.db.insert(schema.checklist).values({
          id: item.id,
          orgId: item.orgId,
          period: item.period,
          title: item.title,
          completed: item.completed,
          completedBy: item.completedBy,
          completedAt: item.completedAt
        }).onConflictDoUpdate({
          target: schema.checklist.id,
          set: {
            completed: item.completed,
            completedBy: item.completedBy,
            completedAt: item.completedAt
          }
        });
      }
    },
    filter: async (predicate: (c: ChecklistItem) => boolean): Promise<ChecklistItem[]> => {
      const rows = await this.db.select().from(schema.checklist);
      return rows.map(r => ({ ...r, completed: r.completed ?? false })).filter(predicate) as ChecklistItem[];
    },
    find: async (predicate: (c: ChecklistItem) => boolean): Promise<ChecklistItem | undefined> => {
      const rows = await this.db.select().from(schema.checklist);
      return rows.map(r => ({ ...r, completed: r.completed ?? false })).find(predicate) as ChecklistItem | undefined;
    }
  };

  // ============ COUNTERPARTIES ============
  async addCounterparty(cp: Counterparty) {
    await this.db.insert(schema.counterparties).values({
      id: cp.id,
      orgId: cp.orgId,
      name: cp.name,
      type: cp.type,
      email: cp.email,
      phone: cp.phone,
      address: cp.address,
      taxId: cp.taxId,
      currency: cp.currency,
      paymentTermsDays: cp.paymentTermsDays,
      isActive: cp.isActive,
      createdAt: cp.createdAt
    }).onConflictDoUpdate({
      target: schema.counterparties.id,
      set: cp
    });
    return cp;
  }

  async listCounterparties(orgId: string): Promise<Counterparty[]> {
    const rows = await this.db.select().from(schema.counterparties).where(eq(schema.counterparties.orgId, orgId));
    return rows.map(r => ({ ...r, isActive: r.isActive ?? true })) as Counterparty[];
  }

  async getCounterparty(id: string): Promise<Counterparty | undefined> {
    const rows = await this.db.select().from(schema.counterparties).where(eq(schema.counterparties.id, id));
    if (rows.length === 0) return undefined;
    return { ...rows[0], isActive: rows[0].isActive ?? true } as Counterparty;
  }

  // ============ INVOICES ============
  async addInvoice(invoice: Invoice) {
    await this.db.insert(schema.invoices).values({
      id: invoice.id,
      orgId: invoice.orgId,
      invoiceNumber: invoice.invoiceNumber,
      type: invoice.type,
      counterpartyId: invoice.counterpartyId,
      counterpartyName: invoice.counterpartyName,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      paidDate: invoice.paidDate,
      paidAmount: invoice.paidAmount,
      notes: invoice.notes,
      createdBy: invoice.createdBy,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    }).onConflictDoUpdate({
      target: schema.invoices.id,
      set: {
        status: invoice.status,
        paidDate: invoice.paidDate,
        paidAmount: invoice.paidAmount,
        notes: invoice.notes,
        updatedAt: invoice.updatedAt
      }
    });

    // Handle line items
    await this.db.delete(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, invoice.id));
    for (const line of invoice.lineItems) {
      await this.db.insert(schema.invoiceLines).values({
        id: line.id,
        invoiceId: invoice.id,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        accountId: line.accountId,
        taxRate: line.taxRate,
        amount: line.amount
      });
    }
    return invoice;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const rows = await this.db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
    if (rows.length === 0) return undefined;
    const lines = await this.db.select().from(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, id));
    return { ...rows[0], lineItems: lines as InvoiceLineItem[] } as Invoice;
  }

  async listInvoices(orgId: string): Promise<Invoice[]> {
    const rows = await this.db.select().from(schema.invoices)
      .where(eq(schema.invoices.orgId, orgId))
      .orderBy(desc(schema.invoices.issueDate));
    const results: Invoice[] = [];
    for (const row of rows) {
      const lines = await this.db.select().from(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, row.id));
      results.push({ ...row, lineItems: lines as InvoiceLineItem[] } as Invoice);
    }
    return results;
  }

  async updateInvoice(id: string, patch: Partial<Invoice>) {
    const existing = await this.getInvoice(id);
    if (!existing) throw new Error("Invoice not found");
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return this.addInvoice(updated);
  }

  async nextInvoiceNumber(orgId: string, type: string): Promise<string> {
    const rows = await this.db.select({ count: sql<number>`count(*)` }).from(schema.invoices)
      .where(and(eq(schema.invoices.orgId, orgId), eq(schema.invoices.type, type)));
    const count = rows[0]?.count ?? 0;
    const prefix = type === "receivable" ? "INV" : "BILL";
    return `${prefix}-${String(count + 1).padStart(5, "0")}`;
  }

  // ============ EXPENSES ============
  async addExpense(expense: Expense) {
    await this.db.insert(schema.expenses).values({
      id: expense.id,
      orgId: expense.orgId,
      category: expense.category,
      vendor: expense.vendor,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      date: expense.date,
      receiptUrl: expense.receiptUrl,
      reimbursable: expense.reimbursable,
      status: expense.status,
      paidBy: expense.paidBy,
      approvedBy: expense.approvedBy,
      approvedAt: expense.approvedAt,
      accountId: expense.accountId,
      taxAmount: expense.taxAmount,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt
    }).onConflictDoUpdate({
      target: schema.expenses.id,
      set: {
        status: expense.status,
        approvedBy: expense.approvedBy,
        approvedAt: expense.approvedAt,
        updatedAt: expense.updatedAt
      }
    });
    return expense;
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const rows = await this.db.select().from(schema.expenses).where(eq(schema.expenses.id, id));
    if (rows.length === 0) return undefined;
    return { ...rows[0], reimbursable: rows[0].reimbursable ?? false } as Expense;
  }

  async listExpenses(orgId: string): Promise<Expense[]> {
    const rows = await this.db.select().from(schema.expenses)
      .where(eq(schema.expenses.orgId, orgId))
      .orderBy(desc(schema.expenses.date));
    return rows.map(r => ({ ...r, reimbursable: r.reimbursable ?? false })) as Expense[];
  }

  async updateExpense(id: string, patch: Partial<Expense>) {
    const existing = await this.getExpense(id);
    if (!existing) throw new Error("Expense not found");
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return this.addExpense(updated);
  }

  // ============ EMPLOYEES ============
  async addEmployee(emp: Employee) {
    await this.db.insert(schema.employees).values({
      id: emp.id,
      orgId: emp.orgId,
      name: emp.name,
      email: emp.email,
      position: emp.position,
      baseSalary: emp.baseSalary,
      currency: emp.currency,
      taxId: emp.taxId,
      bankAccount: emp.bankAccount,
      startDate: emp.startDate,
      isActive: emp.isActive
    }).onConflictDoUpdate({
      target: schema.employees.id,
      set: emp
    });
    return emp;
  }

  async listEmployees(orgId: string): Promise<Employee[]> {
    const rows = await this.db.select().from(schema.employees).where(eq(schema.employees.orgId, orgId));
    return rows.map(r => ({ ...r, isActive: r.isActive ?? true })) as Employee[];
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const rows = await this.db.select().from(schema.employees).where(eq(schema.employees.id, id));
    if (rows.length === 0) return undefined;
    return { ...rows[0], isActive: rows[0].isActive ?? true } as Employee;
  }

  // ============ PAYROLL ============
  async addPayrollRun(run: PayrollRun) {
    await this.db.insert(schema.payrollRuns).values({
      id: run.id,
      orgId: run.orgId,
      period: run.period,
      totalGross: run.totalGross,
      totalTax: run.totalTax,
      totalDeductions: run.totalDeductions,
      totalNet: run.totalNet,
      currency: run.currency,
      status: run.status,
      approvedBy: run.approvedBy,
      approvedAt: run.approvedAt,
      finalizedBy: run.finalizedBy,
      finalizedAt: run.finalizedAt,
      createdBy: run.createdBy,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt
    }).onConflictDoUpdate({
      target: schema.payrollRuns.id,
      set: {
        status: run.status,
        approvedBy: run.approvedBy,
        approvedAt: run.approvedAt,
        finalizedBy: run.finalizedBy,
        finalizedAt: run.finalizedAt,
        updatedAt: run.updatedAt
      }
    });

    await this.db.delete(schema.payrollLines).where(eq(schema.payrollLines.payrollRunId, run.id));
    for (const line of run.lines) {
      await this.db.insert(schema.payrollLines).values({
        id: line.id,
        payrollRunId: run.id,
        employeeId: line.employeeId,
        employeeName: line.employeeName,
        grossPay: line.grossPay,
        taxWithholding: line.taxWithholding,
        otherDeductions: line.otherDeductions,
        netPay: line.netPay
      });
    }
    return run;
  }

  async getPayrollRun(id: string): Promise<PayrollRun | undefined> {
    const rows = await this.db.select().from(schema.payrollRuns).where(eq(schema.payrollRuns.id, id));
    if (rows.length === 0) return undefined;
    const lines = await this.db.select().from(schema.payrollLines).where(eq(schema.payrollLines.payrollRunId, id));
    return { ...rows[0], lines: lines as PayrollLine[] } as PayrollRun;
  }

  async listPayrollRuns(orgId: string): Promise<PayrollRun[]> {
    const rows = await this.db.select().from(schema.payrollRuns)
      .where(eq(schema.payrollRuns.orgId, orgId))
      .orderBy(desc(schema.payrollRuns.period));
    const results: PayrollRun[] = [];
    for (const row of rows) {
      const lines = await this.db.select().from(schema.payrollLines).where(eq(schema.payrollLines.payrollRunId, row.id));
      results.push({ ...row, lines: lines as PayrollLine[] } as PayrollRun);
    }
    return results;
  }

  async updatePayrollRun(id: string, patch: Partial<PayrollRun>) {
    const existing = await this.getPayrollRun(id);
    if (!existing) throw new Error("PayrollRun not found");
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return this.addPayrollRun(updated);
  }

  // ============ BANK TRANSACTIONS ============
  async addBankTransaction(txn: BankTransaction) {
    await this.db.insert(schema.bankTransactions).values({
      id: txn.id,
      orgId: txn.orgId,
      bankAccountId: txn.bankAccountId,
      date: txn.date,
      description: txn.description,
      amount: txn.amount,
      currency: txn.currency,
      type: txn.type,
      category: txn.category,
      accountId: txn.accountId,
      status: txn.status,
      externalRef: txn.externalRef,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt
    }).onConflictDoUpdate({
      target: schema.bankTransactions.id,
      set: {
        category: txn.category,
        accountId: txn.accountId,
        status: txn.status,
        updatedAt: txn.updatedAt
      }
    });
    return txn;
  }

  async listBankTransactions(orgId: string): Promise<BankTransaction[]> {
    const rows = await this.db.select().from(schema.bankTransactions)
      .where(eq(schema.bankTransactions.orgId, orgId))
      .orderBy(desc(schema.bankTransactions.date));
    return rows as BankTransaction[];
  }

  async getBankTransaction(id: string): Promise<BankTransaction | undefined> {
    const rows = await this.db.select().from(schema.bankTransactions).where(eq(schema.bankTransactions.id, id));
    return rows[0] as BankTransaction | undefined;
  }

  async updateBankTransaction(id: string, patch: Partial<BankTransaction>) {
    const existing = await this.getBankTransaction(id);
    if (!existing) throw new Error("BankTransaction not found");
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return this.addBankTransaction(updated);
  }

  // ============ CRYPTO TRANSACTIONS & LOTS ============
  async addCryptoTransaction(txn: CryptoTransaction) {
    await this.db.insert(schema.cryptoTransactions).values({
      id: txn.id,
      orgId: txn.orgId,
      walletId: txn.walletId,
      txHash: txn.txHash,
      type: txn.type,
      tokenSymbol: txn.tokenSymbol,
      quantity: txn.quantity,
      priceUsd: txn.priceUsd,
      valueUsd: txn.valueUsd,
      feeUsd: txn.feeUsd,
      timestamp: txn.timestamp,
      fromAddress: txn.fromAddress,
      toAddress: txn.toAddress,
      swapToToken: txn.swapToToken,
      swapToQty: txn.swapToQty ? parseFloat(txn.swapToQty) : null,
      createdAt: txn.createdAt
    }).onConflictDoUpdate({
      target: schema.cryptoTransactions.id,
      set: {
        type: txn.type,
        tokenSymbol: txn.tokenSymbol,
        quantity: txn.quantity,
        priceUsd: txn.priceUsd,
        valueUsd: txn.valueUsd,
        feeUsd: txn.feeUsd,
        timestamp: txn.timestamp,
        fromAddress: txn.fromAddress,
        toAddress: txn.toAddress,
        swapToToken: txn.swapToToken,
        swapToQty: txn.swapToQty ? parseFloat(txn.swapToQty) : null
      }
    });
    return txn;
  }

  async listCryptoTransactions(orgId: string): Promise<CryptoTransaction[]> {
    const rows = await this.db.select().from(schema.cryptoTransactions)
      .where(eq(schema.cryptoTransactions.orgId, orgId))
      .orderBy(desc(schema.cryptoTransactions.timestamp));
    // Convert swapToQty back to string for type compatibility
    return rows.map(r => ({
      ...r,
      swapToQty: r.swapToQty?.toString()
    })) as CryptoTransaction[];
  }

  async addCryptoLot(lot: CryptoLot) {
    await this.db.insert(schema.cryptoLots).values({
      id: lot.id,
      orgId: lot.orgId,
      tokenSymbol: lot.tokenSymbol,
      quantity: lot.quantity,
      costBasisUsd: lot.costBasisUsd,
      acquiredAt: lot.acquiredAt,
      txnId: lot.txnId,
      remainingQty: lot.remainingQty
    }).onConflictDoUpdate({
      target: schema.cryptoLots.id,
      set: lot
    });
    return lot;
  }

  async listCryptoLots(orgId: string, tokenSymbol?: string): Promise<CryptoLot[]> {
    if (tokenSymbol) {
      const rows = await this.db.select().from(schema.cryptoLots)
        .where(and(eq(schema.cryptoLots.orgId, orgId), eq(schema.cryptoLots.tokenSymbol, tokenSymbol)));
      return rows as CryptoLot[];
    }
    const rows = await this.db.select().from(schema.cryptoLots).where(eq(schema.cryptoLots.orgId, orgId));
    return rows as CryptoLot[];
  }

  async updateCryptoLot(id: string, patch: Partial<CryptoLot>) {
    const rows = await this.db.select().from(schema.cryptoLots).where(eq(schema.cryptoLots.id, id));
    if (rows.length === 0) throw new Error("CryptoLot not found");
    const updated = { ...rows[0], ...patch };
    return this.addCryptoLot(updated as CryptoLot);
  }

  // ============ ASSETS ============
  async addAsset(asset: Asset) {
    await this.db.insert(schema.assets).values({
      id: asset.id,
      orgId: asset.orgId,
      name: asset.name,
      description: asset.description,
      category: asset.category,
      purchaseDate: asset.purchaseDate,
      cost: asset.cost,
      salvageValue: asset.salvageValue,
      usefulLifeMonths: asset.usefulLifeMonths,
      depreciationMethod: asset.depreciationMethod,
      accountId: asset.accountId,
      depreciationAccountId: asset.depreciationAccountId,
      currency: asset.currency,
      isActive: asset.isActive,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt
    }).onConflictDoUpdate({
      target: schema.assets.id,
      set: asset
    });
    return asset;
  }

  async listAssets(orgId: string): Promise<Asset[]> {
    const rows = await this.db.select().from(schema.assets).where(eq(schema.assets.orgId, orgId));
    return rows.map(r => ({ ...r, isActive: r.isActive ?? true })) as Asset[];
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    const rows = await this.db.select().from(schema.assets).where(eq(schema.assets.id, id));
    if (rows.length === 0) return undefined;
    return { ...rows[0], isActive: rows[0].isActive ?? true } as Asset;
  }

  async addDepreciationEntry(entry: DepreciationEntry) {
    await this.db.insert(schema.depreciationEntries).values({
      id: entry.id,
      assetId: entry.assetId,
      period: entry.period,
      amount: entry.amount,
      accumulatedDepreciation: entry.accumulatedDepreciation,
      bookValue: entry.bookValue,
      journalId: entry.journalId,
      createdAt: entry.createdAt
    }).onConflictDoUpdate({
      target: schema.depreciationEntries.id,
      set: entry
    });
    return entry;
  }

  async listDepreciationEntries(assetId: string): Promise<DepreciationEntry[]> {
    const rows = await this.db.select().from(schema.depreciationEntries)
      .where(eq(schema.depreciationEntries.assetId, assetId));
    return rows as DepreciationEntry[];
  }

  // ============ TAX RATES ============
  async addTaxRate(rate: TaxRate) {
    await this.db.insert(schema.taxRates).values({
      id: rate.id,
      orgId: rate.orgId,
      name: rate.name,
      rate: rate.rate,
      type: rate.type,
      jurisdiction: rate.jurisdiction,
      isDefault: rate.isDefault,
      isActive: rate.isActive
    }).onConflictDoUpdate({
      target: schema.taxRates.id,
      set: rate
    });
    return rate;
  }

  async listTaxRates(orgId: string): Promise<TaxRate[]> {
    const rows = await this.db.select().from(schema.taxRates).where(eq(schema.taxRates.orgId, orgId));
    return rows.map(r => ({
      ...r,
      isDefault: r.isDefault ?? false,
      isActive: r.isActive ?? true
    })) as TaxRate[];
  }

  async getDefaultTaxRate(orgId: string, type: string): Promise<TaxRate | undefined> {
    const rows = await this.db.select().from(schema.taxRates)
      .where(and(
        eq(schema.taxRates.orgId, orgId),
        eq(schema.taxRates.type, type),
        eq(schema.taxRates.isDefault, true)
      ));
    if (rows.length === 0) return undefined;
    return { ...rows[0], isDefault: true, isActive: rows[0].isActive ?? true } as TaxRate;
  }

  // ============ FORMULAS ============
  async addFormula(formula: Formula) {
    await this.db.insert(schema.formulas).values({
      id: formula.id,
      orgId: formula.orgId,
      name: formula.name,
      description: formula.description,
      expression: formula.expression,
      variables: JSON.stringify(formula.variables),
      category: formula.category,
      createdBy: formula.createdBy,
      createdAt: formula.createdAt,
      updatedAt: formula.updatedAt
    }).onConflictDoUpdate({
      target: schema.formulas.id,
      set: {
        name: formula.name,
        description: formula.description,
        expression: formula.expression,
        variables: JSON.stringify(formula.variables),
        category: formula.category,
        updatedAt: formula.updatedAt
      }
    });
    return formula;
  }

  async listFormulas(orgId: string): Promise<Formula[]> {
    const rows = await this.db.select().from(schema.formulas).where(eq(schema.formulas.orgId, orgId));
    return rows.map(r => ({ ...r, variables: JSON.parse(r.variables || "[]") })) as Formula[];
  }

  async getFormula(id: string): Promise<Formula | undefined> {
    const rows = await this.db.select().from(schema.formulas).where(eq(schema.formulas.id, id));
    if (rows.length === 0) return undefined;
    return { ...rows[0], variables: JSON.parse(rows[0].variables || "[]") } as Formula;
  }

  // ============ USERS ============
  async createUser(user: { id: string; email: string; passwordHash: string; name?: string; orgId: string; roles: Role[] }) {
    const now = new Date().toISOString();
    await this.db.insert(schema.users).values({
      id: user.id,
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      name: user.name,
      orgId: user.orgId,
      roles: JSON.stringify(user.roles),
      isActive: true,
      emailVerified: false,
      createdAt: now,
      updatedAt: now
    });
    return this.getUserById(user.id);
  }

  async getUserByEmail(email: string) {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase()));
    if (rows.length === 0) return undefined;
    const row = rows[0];
    return {
      ...row,
      roles: JSON.parse(row.roles || "[]"),
      isActive: row.isActive ?? true,
      emailVerified: row.emailVerified ?? false
    };
  }

  async getUserById(id: string) {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    if (rows.length === 0) return undefined;
    const row = rows[0];
    return {
      ...row,
      roles: JSON.parse(row.roles || "[]"),
      isActive: row.isActive ?? true,
      emailVerified: row.emailVerified ?? false
    };
  }

  async updateUserLastLogin(userId: string) {
    await this.db.update(schema.users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(schema.users.id, userId));
  }

  async updateUser(userId: string, patch: { name?: string; roles?: Role[]; isActive?: boolean }) {
    const existing = await this.getUserById(userId);
    if (!existing) throw new Error("User not found");
    
    const updates: Partial<typeof schema.users.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.roles !== undefined) updates.roles = JSON.stringify(patch.roles);
    if (patch.isActive !== undefined) updates.isActive = patch.isActive;
    
    await this.db.update(schema.users).set(updates).where(eq(schema.users.id, userId));
    return this.getUserById(userId);
  }

  async listUsersByOrg(orgId: string) {
    const rows = await this.db.select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      orgId: schema.users.orgId,
      roles: schema.users.roles,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt,
      lastLoginAt: schema.users.lastLoginAt
    }).from(schema.users).where(eq(schema.users.orgId, orgId));
    return rows.map(r => ({
      ...r,
      roles: JSON.parse(r.roles || "[]"),
      isActive: r.isActive ?? true
    }));
  }

  // ============ REFRESH TOKENS ============
  async createRefreshToken(userId: string, token: string, expiresAt: Date) {
    const id = newId();
    await this.db.insert(schema.refreshTokens).values({
      id,
      userId,
      token,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    });
    return { id, token, expiresAt };
  }

  async getRefreshToken(token: string) {
    const rows = await this.db.select().from(schema.refreshTokens)
      .where(and(eq(schema.refreshTokens.token, token), isNull(schema.refreshTokens.revokedAt)));
    return rows[0] as { id: string; userId: string; token: string; expiresAt: string; createdAt: string } | undefined;
  }

  async revokeRefreshToken(token: string) {
    await this.db.update(schema.refreshTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(schema.refreshTokens.token, token));
  }

  async revokeAllUserTokens(userId: string) {
    await this.db.update(schema.refreshTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(schema.refreshTokens.userId, userId), isNull(schema.refreshTokens.revokedAt)));
  }

  async cleanExpiredTokens() {
    await this.db.delete(schema.refreshTokens)
      .where(lt(schema.refreshTokens.expiresAt, new Date().toISOString()));
  }

  // ============ INVITATIONS ============
  async createInvitation(invite: { id: string; orgId: string; email: string; roles: Role[]; invitedBy: string; expiresAt: Date }) {
    await this.db.insert(schema.invitations).values({
      id: invite.id,
      orgId: invite.orgId,
      email: invite.email.toLowerCase(),
      roles: JSON.stringify(invite.roles),
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    });
    return invite;
  }

  async getInvitationByEmail(email: string, orgId: string) {
    const rows = await this.db.select().from(schema.invitations)
      .where(and(
        eq(schema.invitations.email, email.toLowerCase()),
        eq(schema.invitations.orgId, orgId),
        isNull(schema.invitations.acceptedAt)
      ))
      .orderBy(desc(schema.invitations.createdAt))
      .limit(1);
    if (rows.length === 0) return undefined;
    return { ...rows[0], roles: JSON.parse(rows[0].roles || "[]") };
  }

  async acceptInvitation(inviteId: string) {
    await this.db.update(schema.invitations)
      .set({ acceptedAt: new Date().toISOString() })
      .where(eq(schema.invitations.id, inviteId));
  }

  async listPendingInvitations(orgId: string) {
    const now = new Date().toISOString();
    const rows = await this.db.select().from(schema.invitations)
      .where(and(
        eq(schema.invitations.orgId, orgId),
        isNull(schema.invitations.acceptedAt)
      ));
    return rows
      .filter(r => r.expiresAt > now)
      .map(r => ({ ...r, roles: JSON.parse(r.roles || "[]") }));
  }
}
