/**
 * Store Interface
 * Common interface for both SQLite (DbStore) and PostgreSQL (PgStore) stores
 * This allows services to work with either database backend
 */

import {
  Account, Wallet, JournalEntry, PriceTick, FXRate,
  ReconciliationItem, AuditLogEntry, PeriodLock, ChecklistItem, Role,
  TreasuryPolicy, Invoice, Expense, Employee, PayrollRun,
  BankTransaction, CryptoTransaction, CryptoLot, Asset,
  DepreciationEntry, TaxRate, Formula, Counterparty
} from "./types";

export interface IStore {
  // Accounts
  upsertAccount(account: Account): Account | Promise<Account>;
  listAccounts(orgId: string): Account[] | Promise<Account[]>;

  // Wallets
  addWallet(wallet: Wallet): Wallet | Promise<Wallet>;
  listWallets(orgId: string): Wallet[] | Promise<Wallet[]>;

  // Journals
  addJournal(journal: JournalEntry): JournalEntry | Promise<JournalEntry>;
  getJournal(id: string): JournalEntry | undefined | Promise<JournalEntry | undefined>;
  updateJournal(id: string, patch: Partial<JournalEntry>): JournalEntry | Promise<JournalEntry>;
  listJournals(orgId: string): JournalEntry[] | Promise<JournalEntry[]>;

  // Price Ticks
  addPriceTick(price: Omit<PriceTick, "id">): PriceTick | Promise<PriceTick>;
  latestPrice(symbol: string, currency: string): PriceTick | undefined | Promise<PriceTick | undefined>;

  // FX Rates
  addFxRate(rate: Omit<FXRate, "id">): FXRate | Promise<FXRate>;

  // Reconciliations
  addReconciliation(rec: Omit<ReconciliationItem, "id" | "createdAt">): ReconciliationItem | Promise<ReconciliationItem>;
  listReconciliations(orgId: string): ReconciliationItem[] | Promise<ReconciliationItem[]>;

  // Audit Logs
  addAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry | Promise<AuditLogEntry>;
  listAudit(orgId: string): AuditLogEntry[] | Promise<AuditLogEntry[]>;

  // Period Locks
  lockPeriod(lock: PeriodLock): void | Promise<void>;
  isPeriodLocked(orgId: string, period: string): boolean | Promise<boolean>;

  // Roles
  upsertRole(userId: string, roles: Role[]): void | Promise<void>;
  getUserRoles(userId: string): Role[] | Promise<Role[]>;

  // Policies
  setPolicy(orgId: string, policy: TreasuryPolicy): void | Promise<void>;
  getPolicy(orgId: string): TreasuryPolicy | undefined | Promise<TreasuryPolicy | undefined>;

  // Checklist
  checklist: {
    push(...items: ChecklistItem[]): void | Promise<void>;
    filter(predicate: (c: ChecklistItem) => boolean): ChecklistItem[] | Promise<ChecklistItem[]>;
    find(predicate: (c: ChecklistItem) => boolean): ChecklistItem | undefined | Promise<ChecklistItem | undefined>;
  };

  // Counterparties
  addCounterparty(cp: Counterparty): Counterparty | Promise<Counterparty>;
  listCounterparties(orgId: string): Counterparty[] | Promise<Counterparty[]>;
  getCounterparty(id: string): Counterparty | undefined | Promise<Counterparty | undefined>;

  // Invoices
  addInvoice(invoice: Invoice): Invoice | Promise<Invoice>;
  getInvoice(id: string): Invoice | undefined | Promise<Invoice | undefined>;
  listInvoices(orgId: string): Invoice[] | Promise<Invoice[]>;
  updateInvoice(id: string, patch: Partial<Invoice>): Invoice | Promise<Invoice>;
  nextInvoiceNumber(orgId: string, type: string): string | Promise<string>;

  // Expenses
  addExpense(expense: Expense): Expense | Promise<Expense>;
  getExpense(id: string): Expense | undefined | Promise<Expense | undefined>;
  listExpenses(orgId: string): Expense[] | Promise<Expense[]>;
  updateExpense(id: string, patch: Partial<Expense>): Expense | Promise<Expense>;

  // Employees
  addEmployee(emp: Employee): Employee | Promise<Employee>;
  listEmployees(orgId: string): Employee[] | Promise<Employee[]>;
  getEmployee(id: string): Employee | undefined | Promise<Employee | undefined>;

  // Payroll
  addPayrollRun(run: PayrollRun): PayrollRun | Promise<PayrollRun>;
  getPayrollRun(id: string): PayrollRun | undefined | Promise<PayrollRun | undefined>;
  listPayrollRuns(orgId: string): PayrollRun[] | Promise<PayrollRun[]>;
  updatePayrollRun(id: string, patch: Partial<PayrollRun>): PayrollRun | Promise<PayrollRun>;

  // Bank Transactions
  addBankTransaction(txn: BankTransaction): BankTransaction | Promise<BankTransaction>;
  listBankTransactions(orgId: string): BankTransaction[] | Promise<BankTransaction[]>;
  getBankTransaction(id: string): BankTransaction | undefined | Promise<BankTransaction | undefined>;
  updateBankTransaction(id: string, patch: Partial<BankTransaction>): BankTransaction | Promise<BankTransaction>;

  // Crypto
  addCryptoTransaction(txn: CryptoTransaction): CryptoTransaction | Promise<CryptoTransaction>;
  listCryptoTransactions(orgId: string): CryptoTransaction[] | Promise<CryptoTransaction[]>;
  addCryptoLot(lot: CryptoLot): CryptoLot | Promise<CryptoLot>;
  listCryptoLots(orgId: string, tokenSymbol?: string): CryptoLot[] | Promise<CryptoLot[]>;
  updateCryptoLot(id: string, patch: Partial<CryptoLot>): CryptoLot | Promise<CryptoLot>;

  // Assets
  addAsset(asset: Asset): Asset | Promise<Asset>;
  listAssets(orgId: string): Asset[] | Promise<Asset[]>;
  getAsset(id: string): Asset | undefined | Promise<Asset | undefined>;
  addDepreciationEntry(entry: DepreciationEntry): DepreciationEntry | Promise<DepreciationEntry>;
  listDepreciationEntries(assetId: string): DepreciationEntry[] | Promise<DepreciationEntry[]>;

  // Tax Rates
  addTaxRate(rate: TaxRate): TaxRate | Promise<TaxRate>;
  listTaxRates(orgId: string): TaxRate[] | Promise<TaxRate[]>;
  getDefaultTaxRate(orgId: string, type: string): TaxRate | undefined | Promise<TaxRate | undefined>;

  // Formulas
  addFormula(formula: Formula): Formula | Promise<Formula>;
  listFormulas(orgId: string): Formula[] | Promise<Formula[]>;
  getFormula(id: string): Formula | undefined | Promise<Formula | undefined>;

  // Users
  createUser(user: { id: string; email: string; passwordHash: string; name?: string; orgId: string; roles: Role[] }): any | Promise<any>;
  getUserByEmail(email: string): any | Promise<any>;
  getUserById(id: string): any | Promise<any>;
  updateUserLastLogin(userId: string): void | Promise<void>;
  updateUser(userId: string, patch: { name?: string; roles?: Role[]; isActive?: boolean }): any | Promise<any>;
  listUsersByOrg(orgId: string): any[] | Promise<any[]>;

  // Refresh Tokens
  createRefreshToken(userId: string, token: string, expiresAt: Date): any | Promise<any>;
  getRefreshToken(token: string): any | Promise<any>;
  revokeRefreshToken(token: string): void | Promise<void>;
  revokeAllUserTokens(userId: string): void | Promise<void>;
  cleanExpiredTokens(): void | Promise<void>;

  // Invitations
  createInvitation(invite: { id: string; orgId: string; email: string; roles: Role[]; invitedBy: string; expiresAt: Date }): any | Promise<any>;
  getInvitationByEmail(email: string, orgId: string): any | Promise<any>;
  acceptInvitation(inviteId: string): void | Promise<void>;
  listPendingInvitations(orgId: string): any[] | Promise<any[]>;
}
