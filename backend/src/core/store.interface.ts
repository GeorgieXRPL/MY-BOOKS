/**
 * IStore Interface
 * 
 * This interface defines all data access methods that both DbStore (SQLite)
 * and PgStore (PostgreSQL) must implement.
 * 
 * All methods use Promise-compatible return types to work with both
 * synchronous (SQLite) and asynchronous (PostgreSQL) implementations.
 * 
 * Usage: Always await store method calls:
 *   const user = await Promise.resolve(store.getUserById(id));
 */

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
  Expense,
  Employee,
  PayrollRun,
  BankTransaction,
  CryptoTransaction,
  CryptoLot,
  Asset,
  DepreciationEntry,
  TaxRate,
  Formula,
  Counterparty
} from "./types";

// Type that can be either sync or async
type MaybePromise<T> = T | Promise<T>;

export interface IStore {
  // ============ ACCOUNTS ============
  upsertAccount(account: Account): MaybePromise<void>;
  listAccounts(orgId: string): MaybePromise<Account[]>;

  // ============ WALLETS ============
  addWallet(wallet: Wallet): MaybePromise<void>;
  listWallets(orgId: string): MaybePromise<Wallet[]>;

  // ============ JOURNALS ============
  addJournal(journal: JournalEntry): MaybePromise<void>;
  getJournal(id: string): MaybePromise<JournalEntry | undefined>;
  updateJournal(id: string, patch: Partial<JournalEntry>): MaybePromise<void>;
  listJournals(orgId: string): MaybePromise<JournalEntry[]>;

  // ============ PRICING ============
  addPriceTick(price: Omit<PriceTick, "id">): MaybePromise<void>;
  latestPrice(symbol: string, currency: string): MaybePromise<PriceTick | undefined>;
  addFxRate(rate: Omit<FXRate, "id">): MaybePromise<void>;

  // ============ RECONCILIATION ============
  addReconciliation(rec: Omit<ReconciliationItem, "id" | "createdAt">): MaybePromise<void>;
  listReconciliations(orgId: string): MaybePromise<ReconciliationItem[]>;

  // ============ AUDIT ============
  addAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">): MaybePromise<void>;
  listAudit(orgId: string): MaybePromise<AuditLogEntry[]>;

  // ============ PERIOD LOCKS ============
  lockPeriod(lock: PeriodLock): MaybePromise<void>;
  isPeriodLocked(orgId: string, period: string): MaybePromise<boolean>;

  // ============ CHECKLIST ============
  listChecklist?(orgId: string, period: string): MaybePromise<ChecklistItem[]>;
  addChecklistItem?(item: ChecklistItem): MaybePromise<void>;
  updateChecklistItem?(id: string, patch: Partial<ChecklistItem>): MaybePromise<void>;

  // ============ RBAC ============
  upsertRole(userId: string, roles: Role[]): MaybePromise<void>;
  getUserRoles(userId: string): MaybePromise<Role[]>;

  // ============ POLICIES ============
  setPolicy(orgId: string, policy: TreasuryPolicy): MaybePromise<void>;
  getPolicy(orgId: string): MaybePromise<TreasuryPolicy | undefined>;

  // ============ COUNTERPARTIES ============
  addCounterparty(cp: Counterparty): MaybePromise<void>;
  listCounterparties(orgId: string): MaybePromise<Counterparty[]>;
  getCounterparty(id: string): MaybePromise<Counterparty | undefined>;

  // ============ INVOICES ============
  addInvoice(invoice: Invoice): MaybePromise<void>;
  getInvoice(id: string): MaybePromise<Invoice | undefined>;
  listInvoices(orgId: string): MaybePromise<Invoice[]>;
  updateInvoice(id: string, patch: Partial<Invoice>): MaybePromise<void>;
  nextInvoiceNumber(orgId: string, type: string): MaybePromise<string>;

  // ============ EXPENSES ============
  addExpense(expense: Expense): MaybePromise<void>;
  getExpense(id: string): MaybePromise<Expense | undefined>;
  listExpenses(orgId: string): MaybePromise<Expense[]>;
  updateExpense(id: string, patch: Partial<Expense>): MaybePromise<void>;

  // ============ EMPLOYEES ============
  addEmployee(emp: Employee): MaybePromise<void>;
  listEmployees(orgId: string): MaybePromise<Employee[]>;
  getEmployee(id: string): MaybePromise<Employee | undefined>;

  // ============ PAYROLL ============
  addPayrollRun(run: PayrollRun): MaybePromise<void>;
  getPayrollRun(id: string): MaybePromise<PayrollRun | undefined>;
  listPayrollRuns(orgId: string): MaybePromise<PayrollRun[]>;
  updatePayrollRun(id: string, patch: Partial<PayrollRun>): MaybePromise<void>;

  // ============ BANK TRANSACTIONS ============
  addBankTransaction(txn: BankTransaction): MaybePromise<void>;
  listBankTransactions(orgId: string): MaybePromise<BankTransaction[]>;
  getBankTransaction(id: string): MaybePromise<BankTransaction | undefined>;
  updateBankTransaction(id: string, patch: Partial<BankTransaction>): MaybePromise<void>;

  // ============ CRYPTO ============
  addCryptoTransaction(txn: CryptoTransaction): MaybePromise<void>;
  listCryptoTransactions(orgId: string): MaybePromise<CryptoTransaction[]>;
  addCryptoLot(lot: CryptoLot): MaybePromise<void>;
  listCryptoLots(orgId: string, tokenSymbol?: string): MaybePromise<CryptoLot[]>;
  updateCryptoLot(id: string, patch: Partial<CryptoLot>): MaybePromise<void>;

  // ============ ASSETS ============
  addAsset(asset: Asset): MaybePromise<void>;
  listAssets(orgId: string): MaybePromise<Asset[]>;
  getAsset(id: string): MaybePromise<Asset | undefined>;
  addDepreciationEntry(entry: DepreciationEntry): MaybePromise<void>;
  listDepreciationEntries(assetId: string): MaybePromise<DepreciationEntry[]>;

  // ============ TAX ============
  addTaxRate(rate: TaxRate): MaybePromise<void>;
  listTaxRates(orgId: string): MaybePromise<TaxRate[]>;
  getDefaultTaxRate(orgId: string, type: string): MaybePromise<TaxRate | undefined>;

  // ============ FORMULAS ============
  addFormula(formula: Formula): MaybePromise<void>;
  listFormulas(orgId: string): MaybePromise<Formula[]>;
  getFormula(id: string): MaybePromise<Formula | undefined>;

  // ============ USERS ============
  createUser(user: {
    id: string;
    email: string;
    passwordHash: string;
    name?: string;
    orgId: string;
    roles: Role[];
  }): MaybePromise<any>;
  getUserByEmail(email: string): MaybePromise<any>;
  getUserById(id: string): MaybePromise<any>;
  updateUserLastLogin(userId: string): MaybePromise<void>;
  updateUser(userId: string, patch: { name?: string; roles?: Role[]; isActive?: boolean; passwordHash?: string }): MaybePromise<any>;
  listUsersByOrg(orgId: string): MaybePromise<any[]>;

  // ============ TOKENS ============
  createRefreshToken(userId: string, token: string, expiresAt: Date): MaybePromise<void>;
  getRefreshToken(token: string): MaybePromise<{ userId: string; expiresAt: string; revokedAt?: string } | undefined>;
  revokeRefreshToken(token: string): MaybePromise<void>;
  revokeAllUserTokens(userId: string): MaybePromise<void>;

  // ============ INVITATIONS ============
  createInvitation(invite: {
    id: string;
    orgId: string;
    email: string;
    roles: Role[];
    invitedBy: string;
    expiresAt: Date;
  }): MaybePromise<void>;
  getInvitationByEmail(email: string, orgId: string): MaybePromise<any>;
  acceptInvitation(inviteId: string): MaybePromise<void>;
  listPendingInvitations?(orgId: string): MaybePromise<any[]>;
}

/**
 * Helper function to ensure a value is awaited
 * Works with both sync and async values
 */
export async function resolveStore<T>(value: MaybePromise<T>): Promise<T> {
  return Promise.resolve(value);
}
