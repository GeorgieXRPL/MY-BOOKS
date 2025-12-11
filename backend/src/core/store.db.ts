import Database from "better-sqlite3";
import {
  Account,
  AuditLogEntry,
  ChecklistItem,
  FXRate,
  JournalEntry,
  PeriodLock,
  PriceTick,
  ReconciliationItem,
  Role,
  TreasuryPolicy,
  Wallet,
  Invoice,
  InvoiceLineItem,
  Expense,
  Employee,
  PayrollRun,
  PayrollLine,
  BankTransaction,
  CryptoTransaction,
  CryptoLot,
  Asset,
  DepreciationEntry,
  TaxRate,
  Formula,
  Counterparty
} from "./types";
import { buildDefaultCoa } from "./coa";
import { newId } from "../utils/id";

const ddl = `
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  code TEXT,
  name TEXT,
  type TEXT,
  currency TEXT,
  tags TEXT,
  metadata TEXT,
  isActive INTEGER
);
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  address TEXT,
  chain TEXT,
  label TEXT,
  purpose TEXT,
  currency TEXT
);
CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  status TEXT,
  period TEXT,
  createdBy TEXT,
  reviewedBy TEXT,
  postedBy TEXT,
  memo TEXT,
  tags TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  externalRef TEXT
);
CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  journalId TEXT,
  accountId TEXT,
  debit REAL,
  credit REAL,
  currency TEXT,
  description TEXT,
  walletId TEXT,
  tokenSymbol TEXT,
  fxRate REAL,
  externalRef TEXT,
  txHash TEXT
);
CREATE TABLE IF NOT EXISTS price_ticks (
  id TEXT PRIMARY KEY,
  symbol TEXT,
  price REAL,
  currency TEXT,
  timestamp TEXT,
  source TEXT
);
CREATE TABLE IF NOT EXISTS fx_rates (
  id TEXT PRIMARY KEY,
  base TEXT,
  quote TEXT,
  rate REAL,
  timestamp TEXT,
  source TEXT
);
CREATE TABLE IF NOT EXISTS reconciliations (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  source TEXT,
  externalRef TEXT,
  externalBalance REAL,
  ledgerBalance REAL,
  delta REAL,
  status TEXT,
  note TEXT,
  createdAt TEXT
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  actorId TEXT,
  action TEXT,
  entity TEXT,
  entityId TEXT,
  before TEXT,
  after TEXT,
  timestamp TEXT,
  metadata TEXT
);
CREATE TABLE IF NOT EXISTS period_locks (
  orgId TEXT,
  period TEXT,
  lockedBy TEXT,
  lockedAt TEXT
);
CREATE TABLE IF NOT EXISTS checklist (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  period TEXT,
  title TEXT,
  completed INTEGER,
  completedBy TEXT,
  completedAt TEXT
);
CREATE TABLE IF NOT EXISTS roles (
  userId TEXT PRIMARY KEY,
  roles TEXT
);
CREATE TABLE IF NOT EXISTS policies (
  orgId TEXT PRIMARY KEY,
  maxSingleSpend REAL,
  largeTxAlertThreshold REAL,
  minSignerQuorum REAL
);

-- Counterparties (customers/vendors)
CREATE TABLE IF NOT EXISTS counterparties (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  name TEXT,
  type TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  taxId TEXT,
  currency TEXT,
  paymentTermsDays INTEGER,
  isActive INTEGER,
  createdAt TEXT
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  invoiceNumber TEXT,
  type TEXT,
  counterpartyId TEXT,
  counterpartyName TEXT,
  subtotal REAL,
  taxAmount REAL,
  total REAL,
  currency TEXT,
  issueDate TEXT,
  dueDate TEXT,
  status TEXT,
  paidDate TEXT,
  paidAmount REAL,
  notes TEXT,
  createdBy TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  invoiceId TEXT,
  description TEXT,
  quantity REAL,
  unitPrice REAL,
  accountId TEXT,
  taxRate REAL,
  amount REAL
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  category TEXT,
  vendor TEXT,
  description TEXT,
  amount REAL,
  currency TEXT,
  date TEXT,
  receiptUrl TEXT,
  reimbursable INTEGER,
  status TEXT,
  paidBy TEXT,
  approvedBy TEXT,
  approvedAt TEXT,
  accountId TEXT,
  taxAmount REAL,
  createdBy TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  name TEXT,
  email TEXT,
  position TEXT,
  baseSalary REAL,
  currency TEXT,
  taxId TEXT,
  bankAccount TEXT,
  startDate TEXT,
  isActive INTEGER
);

-- Payroll runs
CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  period TEXT,
  totalGross REAL,
  totalTax REAL,
  totalDeductions REAL,
  totalNet REAL,
  currency TEXT,
  status TEXT,
  approvedBy TEXT,
  approvedAt TEXT,
  finalizedBy TEXT,
  finalizedAt TEXT,
  createdBy TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id TEXT PRIMARY KEY,
  payrollRunId TEXT,
  employeeId TEXT,
  employeeName TEXT,
  grossPay REAL,
  taxWithholding REAL,
  otherDeductions REAL,
  netPay REAL
);

-- Bank transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  bankAccountId TEXT,
  date TEXT,
  description TEXT,
  amount REAL,
  currency TEXT,
  type TEXT,
  category TEXT,
  accountId TEXT,
  status TEXT,
  externalRef TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

-- Crypto transactions
CREATE TABLE IF NOT EXISTS crypto_transactions (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  walletId TEXT,
  txHash TEXT,
  type TEXT,
  tokenSymbol TEXT,
  quantity REAL,
  priceUsd REAL,
  valueUsd REAL,
  feeUsd REAL,
  timestamp TEXT,
  fromAddress TEXT,
  toAddress TEXT,
  swapToToken TEXT,
  swapToQty REAL,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS crypto_lots (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  tokenSymbol TEXT,
  quantity REAL,
  costBasisUsd REAL,
  acquiredAt TEXT,
  txnId TEXT,
  remainingQty REAL
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  purchaseDate TEXT,
  cost REAL,
  salvageValue REAL,
  usefulLifeMonths INTEGER,
  depreciationMethod TEXT,
  accountId TEXT,
  depreciationAccountId TEXT,
  currency TEXT,
  isActive INTEGER,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS depreciation_entries (
  id TEXT PRIMARY KEY,
  assetId TEXT,
  period TEXT,
  amount REAL,
  accumulatedDepreciation REAL,
  bookValue REAL,
  journalId TEXT,
  createdAt TEXT
);

-- Tax rates
CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  name TEXT,
  rate REAL,
  type TEXT,
  jurisdiction TEXT,
  isDefault INTEGER,
  isActive INTEGER
);

-- Custom formulas
CREATE TABLE IF NOT EXISTS formulas (
  id TEXT PRIMARY KEY,
  orgId TEXT,
  name TEXT,
  description TEXT,
  expression TEXT,
  variables TEXT,
  category TEXT,
  createdBy TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

-- Users (authentication)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  name TEXT,
  orgId TEXT,
  roles TEXT,
  isActive INTEGER DEFAULT 1,
  emailVerified INTEGER DEFAULT 0,
  createdAt TEXT,
  updatedAt TEXT,
  lastLoginAt TEXT
);

-- Refresh tokens (for secure session management)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT,
  revokedAt TEXT
);

-- Org invitations
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  email TEXT NOT NULL,
  roles TEXT,
  invitedBy TEXT,
  expiresAt TEXT,
  acceptedAt TEXT,
  createdAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userId ON refresh_tokens(userId);
`;

export class DbStore {
  db: Database.Database;

  constructor(filename: string, seedOrgId: string, seedCurrency: string) {
    this.db = new Database(filename);
    this.db.exec(ddl);
    // Seed COA if empty
    const countRow = this.db.prepare("SELECT COUNT(*) as c FROM accounts WHERE orgId = ?").get(seedOrgId) as { c: number };
    const count = countRow?.c ?? 0;
    if (count === 0) {
      const ins = this.db.prepare(
        "INSERT INTO accounts (id, orgId, code, name, type, currency, isActive) VALUES (@id,@orgId,@code,@name,@type,@currency,@isActive)"
      );
      const coa = buildDefaultCoa(seedOrgId, seedCurrency);
      const tx = this.db.transaction(() => {
        for (const acc of coa) {
          ins.run({ ...acc, isActive: acc.isActive ? 1 : 0 });
        }
      });
      tx();
    }
  }

  upsertAccount(account: Account) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO accounts (id, orgId, code, name, type, currency, tags, metadata, isActive) VALUES (@id,@orgId,@code,@name,@type,@currency,@tags,@metadata,@isActive)"
      )
      .run({
        ...account,
        tags: account.tags ? JSON.stringify(account.tags) : null,
        metadata: account.metadata ? JSON.stringify(account.metadata) : null,
        isActive: account.isActive ? 1 : 0
      });
    return account;
  }

  listAccounts(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM accounts WHERE orgId = ?").all(orgId) as any[];
    return rows.map((r) => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      isActive: Boolean(r.isActive)
    })) as Account[];
  }

  addWallet(wallet: Wallet) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO wallets (id, orgId, address, chain, label, purpose, currency) VALUES (@id,@orgId,@address,@chain,@label,@purpose,@currency)"
      )
      .run(wallet);
    return wallet;
  }

  listWallets(orgId: string) {
    return this.db.prepare("SELECT * FROM wallets WHERE orgId = ?").all(orgId) as Wallet[];
  }

  addJournal(journal: JournalEntry) {
    const insertJournal = this.db.prepare(
      "INSERT OR REPLACE INTO journals (id, orgId, status, period, createdBy, reviewedBy, postedBy, memo, tags, createdAt, updatedAt, externalRef) VALUES (@id,@orgId,@status,@period,@createdBy,@reviewedBy,@postedBy,@memo,@tags,@createdAt,@updatedAt,@externalRef)"
    );
    const insertLine = this.db.prepare(
      "INSERT OR REPLACE INTO journal_lines (id, journalId, accountId, debit, credit, currency, description, walletId, tokenSymbol, fxRate, externalRef, txHash) VALUES (@id,@journalId,@accountId,@debit,@credit,@currency,@description,@walletId,@tokenSymbol,@fxRate,@externalRef,@txHash)"
    );
    const tx = this.db.transaction(() => {
      insertJournal.run({
        ...journal,
        tags: journal.tags ? JSON.stringify(journal.tags) : null
      });
      for (const line of journal.lines) {
        insertLine.run({ ...line, journalId: journal.id });
      }
    });
    tx();
    return journal;
  }

  getJournal(id: string) {
    const row = this.db.prepare("SELECT * FROM journals WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    const lines = this.db.prepare("SELECT * FROM journal_lines WHERE journalId = ?").all(id) as any[];
    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      lines
    } as JournalEntry;
  }

  updateJournal(id: string, patch: Partial<JournalEntry>) {
    const existing = this.getJournal(id);
    if (!existing) throw new Error("Journal not found");
    const updated: JournalEntry = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.addJournal(updated);
    return updated;
  }

  listJournals(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM journals WHERE orgId = ?").all(orgId) as any[];
    return rows.map((r) => {
      const lines = this.db.prepare("SELECT * FROM journal_lines WHERE journalId = ?").all(r.id) as any[];
      return { ...r, tags: r.tags ? JSON.parse(r.tags) : undefined, lines } as JournalEntry;
    });
  }

  addPriceTick(price: Omit<PriceTick, "id">) {
    const tick = { ...price, id: newId() };
    this.db
      .prepare("INSERT INTO price_ticks (id, symbol, price, currency, timestamp, source) VALUES (@id,@symbol,@price,@currency,@timestamp,@source)")
      .run(tick);
    return tick;
  }

  latestPrice(symbol: string, currency: string) {
    const row = this.db
      .prepare("SELECT * FROM price_ticks WHERE symbol = ? AND currency = ? ORDER BY timestamp DESC LIMIT 1")
      .get(symbol, currency);
    return row as PriceTick | undefined;
  }

  addFxRate(rate: Omit<FXRate, "id">) {
    const fx = { ...rate, id: newId() };
    this.db.prepare("INSERT INTO fx_rates (id, base, quote, rate, timestamp, source) VALUES (@id,@base,@quote,@rate,@timestamp,@source)").run(fx);
    return fx;
  }

  addReconciliation(rec: Omit<ReconciliationItem, "id" | "createdAt">) {
    const item: ReconciliationItem = { ...rec, id: newId(), createdAt: new Date().toISOString() };
    this.db
      .prepare(
        "INSERT INTO reconciliations (id, orgId, source, externalRef, externalBalance, ledgerBalance, delta, status, note, createdAt) VALUES (@id,@orgId,@source,@externalRef,@externalBalance,@ledgerBalance,@delta,@status,@note,@createdAt)"
      )
      .run(item);
    return item;
  }

  listReconciliations(orgId: string) {
    return this.db.prepare("SELECT * FROM reconciliations WHERE orgId = ?").all(orgId) as ReconciliationItem[];
  }

  addAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
    const log: AuditLogEntry = { ...entry, id: newId(), timestamp: new Date().toISOString() };
    this.db
      .prepare(
        "INSERT INTO audit_logs (id, orgId, actorId, action, entity, entityId, before, after, timestamp, metadata) VALUES (@id,@orgId,@actorId,@action,@entity,@entityId,@before,@after,@timestamp,@metadata)"
      )
      .run({
        ...log,
        before: log.before ? JSON.stringify(log.before) : null,
        after: log.after ? JSON.stringify(log.after) : null,
        metadata: log.metadata ? JSON.stringify(log.metadata) : null
      });
    return log;
  }

  listAudit(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM audit_logs WHERE orgId = ? ORDER BY timestamp DESC").all(orgId) as any[];
    return rows.map((r) => ({
      ...r,
      before: r.before ? JSON.parse(r.before) : undefined,
      after: r.after ? JSON.parse(r.after) : undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined
    })) as AuditLogEntry[];
  }

  lockPeriod(lock: PeriodLock) {
    this.db.prepare("INSERT INTO period_locks (orgId, period, lockedBy, lockedAt) VALUES (@orgId,@period,@lockedBy,@lockedAt)").run(lock);
  }

  isPeriodLocked(orgId: string, period: string) {
    const row = this.db.prepare("SELECT 1 FROM period_locks WHERE orgId = ? AND period = ? LIMIT 1").get(orgId, period);
    return Boolean(row);
  }

  upsertRole(userId: string, roles: Role[]) {
    this.db.prepare("INSERT OR REPLACE INTO roles (userId, roles) VALUES (?, ?)").run(userId, JSON.stringify(roles));
  }

  getUserRoles(userId: string) {
    const row = this.db.prepare("SELECT roles FROM roles WHERE userId = ?").get(userId) as { roles: string } | undefined;
    if (!row) return [];
    try {
      return JSON.parse(row.roles) as Role[];
    } catch {
      return [];
    }
  }

  setPolicy(orgId: string, policy: TreasuryPolicy) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO policies (orgId, maxSingleSpend, largeTxAlertThreshold, minSignerQuorum) VALUES (@orgId,@maxSingleSpend,@largeTxAlertThreshold,@minSignerQuorum)"
      )
      .run(policy);
  }

  getPolicy(orgId: string) {
    return this.db.prepare("SELECT * FROM policies WHERE orgId = ?").get(orgId) as TreasuryPolicy | undefined;
  }

  checklist = {
    push: (...items: ChecklistItem[]) => {
      const stmt = this.db.prepare(
        "INSERT OR REPLACE INTO checklist (id, orgId, period, title, completed, completedBy, completedAt) VALUES (@id,@orgId,@period,@title,@completed,@completedBy,@completedAt)"
      );
      const tx = this.db.transaction(() => {
        for (const item of items) {
          stmt.run({ ...item, completed: item.completed ? 1 : 0 });
        }
      });
      tx();
    },
    filter: (predicate: (c: ChecklistItem) => boolean) => {
      const rows = this.db.prepare("SELECT * FROM checklist").all() as any[];
      return rows
        .map((r) => ({ ...r, completed: Boolean(r.completed) }))
        .filter(predicate) as ChecklistItem[];
    },
    find: (predicate: (c: ChecklistItem) => boolean) => {
      const rows = this.db.prepare("SELECT * FROM checklist").all() as any[];
      return rows.map((r) => ({ ...r, completed: Boolean(r.completed) })).find(predicate);
    }
  };

  // ============ COUNTERPARTIES ============
  addCounterparty(cp: Counterparty) {
    this.db.prepare(
      "INSERT OR REPLACE INTO counterparties (id, orgId, name, type, email, phone, address, taxId, currency, paymentTermsDays, isActive, createdAt) VALUES (@id,@orgId,@name,@type,@email,@phone,@address,@taxId,@currency,@paymentTermsDays,@isActive,@createdAt)"
    ).run({ ...cp, isActive: cp.isActive ? 1 : 0 });
    return cp;
  }

  listCounterparties(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM counterparties WHERE orgId = ?").all(orgId) as any[];
    return rows.map(r => ({ ...r, isActive: Boolean(r.isActive) })) as Counterparty[];
  }

  getCounterparty(id: string) {
    const row = this.db.prepare("SELECT * FROM counterparties WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, isActive: Boolean(row.isActive) } as Counterparty;
  }

  // ============ INVOICES ============
  addInvoice(invoice: Invoice) {
    const insertInvoice = this.db.prepare(
      "INSERT OR REPLACE INTO invoices (id, orgId, invoiceNumber, type, counterpartyId, counterpartyName, subtotal, taxAmount, total, currency, issueDate, dueDate, status, paidDate, paidAmount, notes, createdBy, createdAt, updatedAt) VALUES (@id,@orgId,@invoiceNumber,@type,@counterpartyId,@counterpartyName,@subtotal,@taxAmount,@total,@currency,@issueDate,@dueDate,@status,@paidDate,@paidAmount,@notes,@createdBy,@createdAt,@updatedAt)"
    );
    const insertLine = this.db.prepare(
      "INSERT OR REPLACE INTO invoice_lines (id, invoiceId, description, quantity, unitPrice, accountId, taxRate, amount) VALUES (@id,@invoiceId,@description,@quantity,@unitPrice,@accountId,@taxRate,@amount)"
    );
    const deleteLinesStmt = this.db.prepare("DELETE FROM invoice_lines WHERE invoiceId = ?");
    const tx = this.db.transaction(() => {
      insertInvoice.run(invoice);
      deleteLinesStmt.run(invoice.id);
      for (const line of invoice.lineItems) {
        insertLine.run({ ...line, invoiceId: invoice.id });
      }
    });
    tx();
    return invoice;
  }

  getInvoice(id: string) {
    const row = this.db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    const lines = this.db.prepare("SELECT * FROM invoice_lines WHERE invoiceId = ?").all(id) as InvoiceLineItem[];
    return { ...row, lineItems: lines } as Invoice;
  }

  listInvoices(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM invoices WHERE orgId = ? ORDER BY issueDate DESC").all(orgId) as any[];
    return rows.map(r => {
      const lines = this.db.prepare("SELECT * FROM invoice_lines WHERE invoiceId = ?").all(r.id) as InvoiceLineItem[];
      return { ...r, lineItems: lines } as Invoice;
    });
  }

  updateInvoice(id: string, patch: Partial<Invoice>) {
    const existing = this.getInvoice(id);
    if (!existing) throw new Error("Invoice not found");
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return this.addInvoice(updated);
  }

  nextInvoiceNumber(orgId: string, type: string) {
    const row = this.db.prepare("SELECT COUNT(*) as c FROM invoices WHERE orgId = ? AND type = ?").get(orgId, type) as any;
    const prefix = type === "receivable" ? "INV" : "BILL";
    return `${prefix}-${String(row.c + 1).padStart(5, "0")}`;
  }

  // ============ EXPENSES ============
  addExpense(expense: Expense) {
    this.db.prepare(
      "INSERT OR REPLACE INTO expenses (id, orgId, category, vendor, description, amount, currency, date, receiptUrl, reimbursable, status, paidBy, approvedBy, approvedAt, accountId, taxAmount, createdBy, createdAt, updatedAt) VALUES (@id,@orgId,@category,@vendor,@description,@amount,@currency,@date,@receiptUrl,@reimbursable,@status,@paidBy,@approvedBy,@approvedAt,@accountId,@taxAmount,@createdBy,@createdAt,@updatedAt)"
    ).run({ ...expense, reimbursable: expense.reimbursable ? 1 : 0 });
    return expense;
  }

  getExpense(id: string) {
    const row = this.db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, reimbursable: Boolean(row.reimbursable) } as Expense;
  }

  listExpenses(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM expenses WHERE orgId = ? ORDER BY date DESC").all(orgId) as any[];
    return rows.map(r => ({ ...r, reimbursable: Boolean(r.reimbursable) })) as Expense[];
  }

  updateExpense(id: string, patch: Partial<Expense>) {
    const existing = this.getExpense(id);
    if (!existing) throw new Error("Expense not found");
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return this.addExpense(updated);
  }

  // ============ EMPLOYEES ============
  addEmployee(emp: Employee) {
    this.db.prepare(
      "INSERT OR REPLACE INTO employees (id, orgId, name, email, position, baseSalary, currency, taxId, bankAccount, startDate, isActive) VALUES (@id,@orgId,@name,@email,@position,@baseSalary,@currency,@taxId,@bankAccount,@startDate,@isActive)"
    ).run({ ...emp, isActive: emp.isActive ? 1 : 0 });
    return emp;
  }

  listEmployees(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM employees WHERE orgId = ?").all(orgId) as any[];
    return rows.map(r => ({ ...r, isActive: Boolean(r.isActive) })) as Employee[];
  }

  getEmployee(id: string) {
    const row = this.db.prepare("SELECT * FROM employees WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, isActive: Boolean(row.isActive) } as Employee;
  }

  // ============ PAYROLL ============
  addPayrollRun(run: PayrollRun) {
    const insertRun = this.db.prepare(
      "INSERT OR REPLACE INTO payroll_runs (id, orgId, period, totalGross, totalTax, totalDeductions, totalNet, currency, status, approvedBy, approvedAt, finalizedBy, finalizedAt, createdBy, createdAt, updatedAt) VALUES (@id,@orgId,@period,@totalGross,@totalTax,@totalDeductions,@totalNet,@currency,@status,@approvedBy,@approvedAt,@finalizedBy,@finalizedAt,@createdBy,@createdAt,@updatedAt)"
    );
    const insertLine = this.db.prepare(
      "INSERT OR REPLACE INTO payroll_lines (id, payrollRunId, employeeId, employeeName, grossPay, taxWithholding, otherDeductions, netPay) VALUES (@id,@payrollRunId,@employeeId,@employeeName,@grossPay,@taxWithholding,@otherDeductions,@netPay)"
    );
    const deleteLinesStmt = this.db.prepare("DELETE FROM payroll_lines WHERE payrollRunId = ?");
    const tx = this.db.transaction(() => {
      insertRun.run(run);
      deleteLinesStmt.run(run.id);
      for (const line of run.lines) {
        insertLine.run({ ...line, payrollRunId: run.id });
      }
    });
    tx();
    return run;
  }

  getPayrollRun(id: string) {
    const row = this.db.prepare("SELECT * FROM payroll_runs WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    const lines = this.db.prepare("SELECT * FROM payroll_lines WHERE payrollRunId = ?").all(id) as PayrollLine[];
    return { ...row, lines } as PayrollRun;
  }

  listPayrollRuns(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM payroll_runs WHERE orgId = ? ORDER BY period DESC").all(orgId) as any[];
    return rows.map(r => {
      const lines = this.db.prepare("SELECT * FROM payroll_lines WHERE payrollRunId = ?").all(r.id) as PayrollLine[];
      return { ...r, lines } as PayrollRun;
    });
  }

  updatePayrollRun(id: string, patch: Partial<PayrollRun>) {
    const existing = this.getPayrollRun(id);
    if (!existing) throw new Error("PayrollRun not found");
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return this.addPayrollRun(updated);
  }

  // ============ BANK TRANSACTIONS ============
  addBankTransaction(txn: BankTransaction) {
    this.db.prepare(
      "INSERT OR REPLACE INTO bank_transactions (id, orgId, bankAccountId, date, description, amount, currency, type, category, accountId, status, externalRef, createdAt, updatedAt) VALUES (@id,@orgId,@bankAccountId,@date,@description,@amount,@currency,@type,@category,@accountId,@status,@externalRef,@createdAt,@updatedAt)"
    ).run(txn);
    return txn;
  }

  listBankTransactions(orgId: string) {
    return this.db.prepare("SELECT * FROM bank_transactions WHERE orgId = ? ORDER BY date DESC").all(orgId) as BankTransaction[];
  }

  getBankTransaction(id: string) {
    return this.db.prepare("SELECT * FROM bank_transactions WHERE id = ?").get(id) as BankTransaction | undefined;
  }

  updateBankTransaction(id: string, patch: Partial<BankTransaction>) {
    const existing = this.getBankTransaction(id);
    if (!existing) throw new Error("BankTransaction not found");
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return this.addBankTransaction(updated);
  }

  // ============ CRYPTO TRANSACTIONS & LOTS ============
  addCryptoTransaction(txn: CryptoTransaction) {
    this.db.prepare(
      "INSERT OR REPLACE INTO crypto_transactions (id, orgId, walletId, txHash, type, tokenSymbol, quantity, priceUsd, valueUsd, feeUsd, timestamp, fromAddress, toAddress, swapToToken, swapToQty, createdAt) VALUES (@id,@orgId,@walletId,@txHash,@type,@tokenSymbol,@quantity,@priceUsd,@valueUsd,@feeUsd,@timestamp,@fromAddress,@toAddress,@swapToToken,@swapToQty,@createdAt)"
    ).run(txn);
    return txn;
  }

  listCryptoTransactions(orgId: string) {
    return this.db.prepare("SELECT * FROM crypto_transactions WHERE orgId = ? ORDER BY timestamp DESC").all(orgId) as CryptoTransaction[];
  }

  addCryptoLot(lot: CryptoLot) {
    this.db.prepare(
      "INSERT OR REPLACE INTO crypto_lots (id, orgId, tokenSymbol, quantity, costBasisUsd, acquiredAt, txnId, remainingQty) VALUES (@id,@orgId,@tokenSymbol,@quantity,@costBasisUsd,@acquiredAt,@txnId,@remainingQty)"
    ).run(lot);
    return lot;
  }

  listCryptoLots(orgId: string, tokenSymbol?: string) {
    if (tokenSymbol) {
      return this.db.prepare("SELECT * FROM crypto_lots WHERE orgId = ? AND tokenSymbol = ? ORDER BY acquiredAt").all(orgId, tokenSymbol) as CryptoLot[];
    }
    return this.db.prepare("SELECT * FROM crypto_lots WHERE orgId = ? ORDER BY acquiredAt").all(orgId) as CryptoLot[];
  }

  updateCryptoLot(id: string, patch: Partial<CryptoLot>) {
    const existing = this.db.prepare("SELECT * FROM crypto_lots WHERE id = ?").get(id) as CryptoLot;
    if (!existing) throw new Error("CryptoLot not found");
    const updated = { ...existing, ...patch };
    return this.addCryptoLot(updated);
  }

  // ============ ASSETS ============
  addAsset(asset: Asset) {
    this.db.prepare(
      "INSERT OR REPLACE INTO assets (id, orgId, name, description, category, purchaseDate, cost, salvageValue, usefulLifeMonths, depreciationMethod, accountId, depreciationAccountId, currency, isActive, createdAt, updatedAt) VALUES (@id,@orgId,@name,@description,@category,@purchaseDate,@cost,@salvageValue,@usefulLifeMonths,@depreciationMethod,@accountId,@depreciationAccountId,@currency,@isActive,@createdAt,@updatedAt)"
    ).run({ ...asset, isActive: asset.isActive ? 1 : 0 });
    return asset;
  }

  listAssets(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM assets WHERE orgId = ?").all(orgId) as any[];
    return rows.map(r => ({ ...r, isActive: Boolean(r.isActive) })) as Asset[];
  }

  getAsset(id: string) {
    const row = this.db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, isActive: Boolean(row.isActive) } as Asset;
  }

  addDepreciationEntry(entry: DepreciationEntry) {
    this.db.prepare(
      "INSERT OR REPLACE INTO depreciation_entries (id, assetId, period, amount, accumulatedDepreciation, bookValue, journalId, createdAt) VALUES (@id,@assetId,@period,@amount,@accumulatedDepreciation,@bookValue,@journalId,@createdAt)"
    ).run(entry);
    return entry;
  }

  listDepreciationEntries(assetId: string) {
    return this.db.prepare("SELECT * FROM depreciation_entries WHERE assetId = ? ORDER BY period").all(assetId) as DepreciationEntry[];
  }

  // ============ TAX RATES ============
  addTaxRate(rate: TaxRate) {
    this.db.prepare(
      "INSERT OR REPLACE INTO tax_rates (id, orgId, name, rate, type, jurisdiction, isDefault, isActive) VALUES (@id,@orgId,@name,@rate,@type,@jurisdiction,@isDefault,@isActive)"
    ).run({ ...rate, isDefault: rate.isDefault ? 1 : 0, isActive: rate.isActive ? 1 : 0 });
    return rate;
  }

  listTaxRates(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM tax_rates WHERE orgId = ?").all(orgId) as any[];
    return rows.map(r => ({ ...r, isDefault: Boolean(r.isDefault), isActive: Boolean(r.isActive) })) as TaxRate[];
  }

  getDefaultTaxRate(orgId: string, type: string) {
    const row = this.db.prepare("SELECT * FROM tax_rates WHERE orgId = ? AND type = ? AND isDefault = 1").get(orgId, type) as any;
    if (!row) return undefined;
    return { ...row, isDefault: Boolean(row.isDefault), isActive: Boolean(row.isActive) } as TaxRate;
  }

  // ============ FORMULAS ============
  addFormula(formula: Formula) {
    this.db.prepare(
      "INSERT OR REPLACE INTO formulas (id, orgId, name, description, expression, variables, category, createdBy, createdAt, updatedAt) VALUES (@id,@orgId,@name,@description,@expression,@variables,@category,@createdBy,@createdAt,@updatedAt)"
    ).run({ ...formula, variables: JSON.stringify(formula.variables) });
    return formula;
  }

  listFormulas(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM formulas WHERE orgId = ?").all(orgId) as any[];
    return rows.map(r => ({ ...r, variables: JSON.parse(r.variables || "[]") })) as Formula[];
  }

  getFormula(id: string) {
    const row = this.db.prepare("SELECT * FROM formulas WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, variables: JSON.parse(row.variables || "[]") } as Formula;
  }

  // ============ USERS (Authentication) ============
  createUser(user: {
    id: string;
    email: string;
    passwordHash: string;
    name?: string;
    orgId: string;
    roles: Role[];
  }) {
    const now = new Date().toISOString();
    this.db.prepare(
      "INSERT INTO users (id, email, passwordHash, name, orgId, roles, isActive, emailVerified, createdAt, updatedAt) VALUES (@id, @email, @passwordHash, @name, @orgId, @roles, 1, 0, @createdAt, @updatedAt)"
    ).run({
      ...user,
      roles: JSON.stringify(user.roles),
      createdAt: now,
      updatedAt: now
    });
    return this.getUserById(user.id);
  }

  getUserByEmail(email: string) {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as any;
    if (!row) return undefined;
    return {
      ...row,
      roles: JSON.parse(row.roles || "[]"),
      isActive: Boolean(row.isActive),
      emailVerified: Boolean(row.emailVerified)
    };
  }

  getUserById(id: string) {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      ...row,
      roles: JSON.parse(row.roles || "[]"),
      isActive: Boolean(row.isActive),
      emailVerified: Boolean(row.emailVerified)
    };
  }

  updateUserLastLogin(userId: string) {
    this.db.prepare("UPDATE users SET lastLoginAt = ? WHERE id = ?").run(new Date().toISOString(), userId);
  }

  updateUser(userId: string, patch: { name?: string; roles?: Role[]; isActive?: boolean }) {
    const existing = this.getUserById(userId);
    if (!existing) throw new Error("User not found");
    const updates: string[] = ["updatedAt = @updatedAt"];
    const params: any = { updatedAt: new Date().toISOString(), id: userId };
    if (patch.name !== undefined) { updates.push("name = @name"); params.name = patch.name; }
    if (patch.roles !== undefined) { updates.push("roles = @roles"); params.roles = JSON.stringify(patch.roles); }
    if (patch.isActive !== undefined) { updates.push("isActive = @isActive"); params.isActive = patch.isActive ? 1 : 0; }
    this.db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = @id`).run(params);
    return this.getUserById(userId);
  }

  listUsersByOrg(orgId: string) {
    const rows = this.db.prepare("SELECT id, email, name, orgId, roles, isActive, createdAt, lastLoginAt FROM users WHERE orgId = ?").all(orgId) as any[];
    return rows.map(r => ({
      ...r,
      roles: JSON.parse(r.roles || "[]"),
      isActive: Boolean(r.isActive)
    }));
  }

  // ============ REFRESH TOKENS ============
  createRefreshToken(userId: string, token: string, expiresAt: Date) {
    const id = newId();
    this.db.prepare(
      "INSERT INTO refresh_tokens (id, userId, token, expiresAt, createdAt) VALUES (@id, @userId, @token, @expiresAt, @createdAt)"
    ).run({ id, userId, token, expiresAt: expiresAt.toISOString(), createdAt: new Date().toISOString() });
    return { id, token, expiresAt };
  }

  getRefreshToken(token: string) {
    return this.db.prepare("SELECT * FROM refresh_tokens WHERE token = ? AND revokedAt IS NULL").get(token) as {
      id: string; userId: string; token: string; expiresAt: string; createdAt: string;
    } | undefined;
  }

  revokeRefreshToken(token: string) {
    this.db.prepare("UPDATE refresh_tokens SET revokedAt = ? WHERE token = ?").run(new Date().toISOString(), token);
  }

  revokeAllUserTokens(userId: string) {
    this.db.prepare("UPDATE refresh_tokens SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL").run(new Date().toISOString(), userId);
  }

  cleanExpiredTokens() {
    this.db.prepare("DELETE FROM refresh_tokens WHERE expiresAt < ?").run(new Date().toISOString());
  }

  // ============ INVITATIONS ============
  createInvitation(invite: { id: string; orgId: string; email: string; roles: Role[]; invitedBy: string; expiresAt: Date }) {
    this.db.prepare(
      "INSERT INTO invitations (id, orgId, email, roles, invitedBy, expiresAt, createdAt) VALUES (@id, @orgId, @email, @roles, @invitedBy, @expiresAt, @createdAt)"
    ).run({ ...invite, roles: JSON.stringify(invite.roles), expiresAt: invite.expiresAt.toISOString(), createdAt: new Date().toISOString() });
    return invite;
  }

  getInvitationByEmail(email: string, orgId: string) {
    const row = this.db.prepare("SELECT * FROM invitations WHERE email = ? AND orgId = ? AND acceptedAt IS NULL ORDER BY createdAt DESC LIMIT 1").get(email.toLowerCase(), orgId) as any;
    if (!row) return undefined;
    return { ...row, roles: JSON.parse(row.roles || "[]") };
  }

  acceptInvitation(inviteId: string) {
    this.db.prepare("UPDATE invitations SET acceptedAt = ? WHERE id = ?").run(new Date().toISOString(), inviteId);
  }

  listPendingInvitations(orgId: string) {
    const rows = this.db.prepare("SELECT * FROM invitations WHERE orgId = ? AND acceptedAt IS NULL AND expiresAt > ?").all(orgId, new Date().toISOString()) as any[];
    return rows.map(r => ({ ...r, roles: JSON.parse(r.roles || "[]") }));
  }
}

