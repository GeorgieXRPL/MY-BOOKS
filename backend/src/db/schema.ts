import { pgTable, text, real, integer, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";

// ============ ACCOUNTS ============
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  currency: text("currency").notNull(),
  tags: text("tags"), // JSON string
  metadata: text("metadata"), // JSON string
  isActive: boolean("is_active").default(true)
}, (table) => ({
  orgIdIdx: index("accounts_org_id_idx").on(table.orgId)
}));

// ============ WALLETS ============
export const wallets = pgTable("wallets", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  address: text("address").notNull(),
  chain: text("chain"),
  label: text("label").notNull(),
  purpose: text("purpose").notNull(),
  currency: text("currency")
}, (table) => ({
  orgIdIdx: index("wallets_org_id_idx").on(table.orgId)
}));

// ============ JOURNALS ============
export const journals = pgTable("journals", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  status: text("status").notNull(),
  period: text("period").notNull(),
  createdBy: text("created_by").notNull(),
  reviewedBy: text("reviewed_by"),
  postedBy: text("posted_by"),
  memo: text("memo"),
  tags: text("tags"), // JSON string
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  externalRef: text("external_ref")
}, (table) => ({
  orgIdIdx: index("journals_org_id_idx").on(table.orgId),
  periodIdx: index("journals_period_idx").on(table.period)
}));

export const journalLines = pgTable("journal_lines", {
  id: text("id").primaryKey(),
  journalId: text("journal_id").notNull(),
  accountId: text("account_id").notNull(),
  debit: real("debit").default(0),
  credit: real("credit").default(0),
  currency: text("currency").notNull(),
  description: text("description"),
  walletId: text("wallet_id"),
  tokenSymbol: text("token_symbol"),
  fxRate: real("fx_rate"),
  externalRef: text("external_ref"),
  txHash: text("tx_hash")
}, (table) => ({
  journalIdIdx: index("journal_lines_journal_id_idx").on(table.journalId)
}));

// ============ PRICE TICKS ============
export const priceTicks = pgTable("price_ticks", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  price: real("price").notNull(),
  currency: text("currency").notNull(),
  timestamp: text("timestamp").notNull(),
  source: text("source").notNull()
}, (table) => ({
  symbolCurrencyIdx: index("price_ticks_symbol_currency_idx").on(table.symbol, table.currency)
}));

// ============ FX RATES ============
export const fxRates = pgTable("fx_rates", {
  id: text("id").primaryKey(),
  base: text("base").notNull(),
  quote: text("quote").notNull(),
  rate: real("rate").notNull(),
  timestamp: text("timestamp").notNull(),
  source: text("source").notNull()
});

// ============ RECONCILIATIONS ============
export const reconciliations = pgTable("reconciliations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  source: text("source").notNull(),
  externalRef: text("external_ref").notNull(),
  externalBalance: real("external_balance").notNull(),
  ledgerBalance: real("ledger_balance").notNull(),
  delta: real("delta").notNull(),
  status: text("status").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull()
}, (table) => ({
  orgIdIdx: index("reconciliations_org_id_idx").on(table.orgId)
}));

// ============ AUDIT LOGS ============
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  before: text("before"), // JSON string
  after: text("after"), // JSON string
  timestamp: text("timestamp").notNull(),
  metadata: text("metadata") // JSON string
}, (table) => ({
  orgIdIdx: index("audit_logs_org_id_idx").on(table.orgId),
  timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp)
}));

// ============ PERIOD LOCKS ============
export const periodLocks = pgTable("period_locks", {
  orgId: text("org_id").notNull(),
  period: text("period").notNull(),
  lockedBy: text("locked_by").notNull(),
  lockedAt: text("locked_at").notNull()
}, (table) => ({
  orgIdPeriodIdx: unique("period_locks_org_period_unique").on(table.orgId, table.period)
}));

// ============ CHECKLIST ============
export const checklist = pgTable("checklist", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  period: text("period").notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false),
  completedBy: text("completed_by"),
  completedAt: text("completed_at")
});

// ============ ROLES ============
export const roles = pgTable("roles", {
  userId: text("user_id").primaryKey(),
  roles: text("roles").notNull() // JSON string
});

// ============ POLICIES ============
export const policies = pgTable("policies", {
  orgId: text("org_id").primaryKey(),
  maxSingleSpend: real("max_single_spend").notNull(),
  largeTxAlertThreshold: real("large_tx_alert_threshold").notNull(),
  minSignerQuorum: real("min_signer_quorum").notNull()
});

// ============ COUNTERPARTIES ============
export const counterparties = pgTable("counterparties", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  taxId: text("tax_id"),
  currency: text("currency").notNull(),
  paymentTermsDays: integer("payment_terms_days").default(30),
  isActive: boolean("is_active").default(true),
  createdAt: text("created_at").notNull()
}, (table) => ({
  orgIdIdx: index("counterparties_org_id_idx").on(table.orgId)
}));

// ============ INVOICES ============
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  type: text("type").notNull(),
  counterpartyId: text("counterparty_id").notNull(),
  counterpartyName: text("counterparty_name").notNull(),
  subtotal: real("subtotal").notNull(),
  taxAmount: real("tax_amount").notNull(),
  total: real("total").notNull(),
  currency: text("currency").notNull(),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull(),
  paidDate: text("paid_date"),
  paidAmount: real("paid_amount"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => ({
  orgIdIdx: index("invoices_org_id_idx").on(table.orgId),
  statusIdx: index("invoices_status_idx").on(table.status)
}));

export const invoiceLines = pgTable("invoice_lines", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  accountId: text("account_id").notNull(),
  taxRate: real("tax_rate").notNull(),
  amount: real("amount").notNull()
}, (table) => ({
  invoiceIdIdx: index("invoice_lines_invoice_id_idx").on(table.invoiceId)
}));

// ============ EXPENSES ============
export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  category: text("category").notNull(),
  vendor: text("vendor").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  date: text("date").notNull(),
  receiptUrl: text("receipt_url"),
  reimbursable: boolean("reimbursable").default(false),
  status: text("status").notNull(),
  paidBy: text("paid_by").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  accountId: text("account_id").notNull(),
  taxAmount: real("tax_amount").default(0),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => ({
  orgIdIdx: index("expenses_org_id_idx").on(table.orgId)
}));

// ============ EMPLOYEES ============
export const employees = pgTable("employees", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  position: text("position").notNull(),
  baseSalary: real("base_salary").notNull(),
  currency: text("currency").notNull(),
  taxId: text("tax_id"),
  bankAccount: text("bank_account"),
  startDate: text("start_date").notNull(),
  isActive: boolean("is_active").default(true)
}, (table) => ({
  orgIdIdx: index("employees_org_id_idx").on(table.orgId)
}));

// ============ PAYROLL ============
export const payrollRuns = pgTable("payroll_runs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  period: text("period").notNull(),
  totalGross: real("total_gross").notNull(),
  totalTax: real("total_tax").notNull(),
  totalDeductions: real("total_deductions").notNull(),
  totalNet: real("total_net").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  finalizedBy: text("finalized_by"),
  finalizedAt: text("finalized_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => ({
  orgIdIdx: index("payroll_runs_org_id_idx").on(table.orgId)
}));

export const payrollLines = pgTable("payroll_lines", {
  id: text("id").primaryKey(),
  payrollRunId: text("payroll_run_id").notNull(),
  employeeId: text("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  grossPay: real("gross_pay").notNull(),
  taxWithholding: real("tax_withholding").notNull(),
  otherDeductions: real("other_deductions").notNull(),
  netPay: real("net_pay").notNull()
}, (table) => ({
  payrollRunIdIdx: index("payroll_lines_payroll_run_id_idx").on(table.payrollRunId)
}));

// ============ BANK TRANSACTIONS ============
export const bankTransactions = pgTable("bank_transactions", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  bankAccountId: text("bank_account_id").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  type: text("type").notNull(),
  category: text("category"),
  accountId: text("account_id"),
  status: text("status").notNull(),
  externalRef: text("external_ref"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => ({
  orgIdIdx: index("bank_transactions_org_id_idx").on(table.orgId)
}));

// ============ CRYPTO TRANSACTIONS ============
export const cryptoTransactions = pgTable("crypto_transactions", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  walletId: text("wallet_id").notNull(),
  txHash: text("tx_hash").notNull(),
  type: text("type").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  quantity: real("quantity").notNull(),
  priceUsd: real("price_usd").notNull(),
  valueUsd: real("value_usd").notNull(),
  feeUsd: real("fee_usd").notNull(),
  timestamp: text("timestamp").notNull(),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  swapToToken: text("swap_to_token"),
  swapToQty: real("swap_to_qty"),
  createdAt: text("created_at").notNull()
}, (table) => ({
  orgIdIdx: index("crypto_transactions_org_id_idx").on(table.orgId),
  txHashIdx: index("crypto_transactions_tx_hash_idx").on(table.txHash)
}));

export const cryptoLots = pgTable("crypto_lots", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  quantity: real("quantity").notNull(),
  costBasisUsd: real("cost_basis_usd").notNull(),
  acquiredAt: text("acquired_at").notNull(),
  txnId: text("txn_id").notNull(),
  remainingQty: real("remaining_qty").notNull()
}, (table) => ({
  orgIdTokenIdx: index("crypto_lots_org_id_token_idx").on(table.orgId, table.tokenSymbol)
}));

// ============ ASSETS ============
export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  purchaseDate: text("purchase_date").notNull(),
  cost: real("cost").notNull(),
  salvageValue: real("salvage_value").notNull(),
  usefulLifeMonths: integer("useful_life_months").notNull(),
  depreciationMethod: text("depreciation_method").notNull(),
  accountId: text("account_id").notNull(),
  depreciationAccountId: text("depreciation_account_id").notNull(),
  currency: text("currency").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => ({
  orgIdIdx: index("assets_org_id_idx").on(table.orgId)
}));

export const depreciationEntries = pgTable("depreciation_entries", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  period: text("period").notNull(),
  amount: real("amount").notNull(),
  accumulatedDepreciation: real("accumulated_depreciation").notNull(),
  bookValue: real("book_value").notNull(),
  journalId: text("journal_id"),
  createdAt: text("created_at").notNull()
}, (table) => ({
  assetIdIdx: index("depreciation_entries_asset_id_idx").on(table.assetId)
}));

// ============ TAX RATES ============
export const taxRates = pgTable("tax_rates", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  rate: real("rate").notNull(),
  type: text("type").notNull(),
  jurisdiction: text("jurisdiction"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true)
}, (table) => ({
  orgIdIdx: index("tax_rates_org_id_idx").on(table.orgId)
}));

// ============ FORMULAS ============
export const formulas = pgTable("formulas", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  expression: text("expression").notNull(),
  variables: text("variables").notNull(), // JSON string
  category: text("category").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => ({
  orgIdIdx: index("formulas_org_id_idx").on(table.orgId)
}));

// ============ USERS ============
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  orgId: text("org_id").notNull(),
  roles: text("roles").notNull(), // JSON string
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastLoginAt: text("last_login_at")
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
  orgIdIdx: index("users_org_id_idx").on(table.orgId)
}));

// ============ REFRESH TOKENS ============
export const refreshTokens = pgTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at")
}, (table) => ({
  tokenIdx: index("refresh_tokens_token_idx").on(table.token),
  userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId)
}));

// ============ INVITATIONS ============
export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  email: text("email").notNull(),
  roles: text("roles").notNull(), // JSON string
  invitedBy: text("invited_by").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at").notNull()
}, (table) => ({
  orgIdIdx: index("invitations_org_id_idx").on(table.orgId),
  emailIdx: index("invitations_email_idx").on(table.email)
}));
