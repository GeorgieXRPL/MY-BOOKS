export type Role = "admin" | "approver" | "poster" | "viewer" | "auditor";

export type JournalStatus = "draft" | "reviewed" | "posted";

export enum AccountType {
  Asset = "ASSET",
  Liability = "LIABILITY",
  Equity = "EQUITY",
  Revenue = "REVENUE",
  Expense = "EXPENSE"
}

export interface Account {
  id: string;
  orgId: string;
  code: string;
  name: string;
  type: AccountType;
  currency: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface Wallet {
  id: string;
  orgId: string;
  address: string;
  chain?: string;
  label: string;
  purpose: "treasury" | "ops" | "cex" | "bank";
  currency?: string;
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  currency: string;
  description?: string;
  walletId?: string;
  tokenSymbol?: string;
  fxRate?: number;
  externalRef?: string;
  txHash?: string;
}

export interface JournalEntry {
  id: string;
  orgId: string;
  status: JournalStatus;
  lines: JournalLine[];
  period: string; // YYYY-MM
  createdBy: string;
  reviewedBy?: string;
  postedBy?: string;
  memo?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  externalRef?: string;
}

export interface PriceTick {
  id: string;
  symbol: string;
  price: number;
  currency: string;
  timestamp: string;
  source: string;
}

export interface FXRate {
  id: string;
  base: string;
  quote: string;
  rate: number;
  timestamp: string;
  source: string;
}

export interface ReconciliationItem {
  id: string;
  orgId: string;
  source: "wallet" | "bank" | "cex";
  externalRef: string;
  externalBalance: number;
  ledgerBalance: number;
  delta: number;
  status: "unmatched" | "matched" | "ignored";
  note?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  orgId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PeriodLock {
  orgId: string;
  period: string;
  lockedBy: string;
  lockedAt: string;
}

export interface ChecklistItem {
  id: string;
  orgId: string;
  period: string;
  title: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

export interface TreasuryPolicy {
  maxSingleSpend: number;
  largeTxAlertThreshold: number;
  minSignerQuorum: number;
}

export interface NormalizedTxn {
  id: string;
  orgId: string;
  amount: number;
  currency: string;
  direction: "inflow" | "outflow";
  description: string;
  occurredAt: string;
  walletId?: string;
  externalRef?: string;
  counterparty?: string;
  tokenSymbol?: string;
  usdValue?: number;
}

// ============ INVOICE MODULE ============
export type InvoiceType = "receivable" | "payable";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  accountId: string;
  taxRate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  orgId: string;
  invoiceNumber: string;
  type: InvoiceType;
  counterpartyId: string;
  counterpartyName: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidDate?: string;
  paidAmount?: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============ EXPENSE MODULE ============
export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "paid";

export interface Expense {
  id: string;
  orgId: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  receiptUrl?: string;
  reimbursable: boolean;
  status: ExpenseStatus;
  paidBy: string;
  approvedBy?: string;
  approvedAt?: string;
  accountId: string;
  taxAmount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============ PAYROLL MODULE ============
export type PayrollStatus = "draft" | "calculated" | "approved" | "finalized";

export interface Employee {
  id: string;
  orgId: string;
  name: string;
  email: string;
  position: string;
  baseSalary: number;
  currency: string;
  taxId?: string;
  bankAccount?: string;
  startDate: string;
  isActive: boolean;
}

export interface PayrollLine {
  id: string;
  employeeId: string;
  employeeName: string;
  grossPay: number;
  taxWithholding: number;
  otherDeductions: number;
  netPay: number;
}

export interface PayrollRun {
  id: string;
  orgId: string;
  period: string;
  lines: PayrollLine[];
  totalGross: number;
  totalTax: number;
  totalDeductions: number;
  totalNet: number;
  currency: string;
  status: PayrollStatus;
  approvedBy?: string;
  approvedAt?: string;
  finalizedBy?: string;
  finalizedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============ BANK TRANSACTIONS ============
export type BankTxnStatus = "uncategorized" | "categorized" | "reconciled";

export interface BankTransaction {
  id: string;
  orgId: string;
  bankAccountId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: "debit" | "credit";
  category?: string;
  accountId?: string;
  status: BankTxnStatus;
  externalRef?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ CRYPTO TRANSACTIONS ============
export type CryptoTxnType = "transfer" | "swap" | "stake" | "unstake" | "reward" | "fee";

export interface CryptoLot {
  id: string;
  orgId: string;
  tokenSymbol: string;
  quantity: number;
  costBasisUsd: number;
  acquiredAt: string;
  txnId: string;
  remainingQty: number;
}

export interface CryptoTransaction {
  id: string;
  orgId: string;
  walletId: string;
  txHash: string;
  type: CryptoTxnType;
  tokenSymbol: string;
  quantity: number;
  priceUsd: number;
  valueUsd: number;
  feeUsd: number;
  timestamp: string;
  fromAddress?: string;
  toAddress?: string;
  swapToToken?: string;
  swapToQty?: string;
  createdAt: string;
}

// ============ ASSETS & DEPRECIATION ============
export type DepreciationMethod = "straight-line" | "declining-balance" | "units-of-production";

export interface Asset {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  category: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  accountId: string;
  depreciationAccountId: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DepreciationEntry {
  id: string;
  assetId: string;
  period: string;
  amount: number;
  accumulatedDepreciation: number;
  bookValue: number;
  journalId?: string;
  createdAt: string;
}

// ============ TAX SETTINGS ============
export interface TaxRate {
  id: string;
  orgId: string;
  name: string;
  rate: number;
  type: "sales" | "income" | "payroll" | "withholding";
  jurisdiction?: string;
  isDefault: boolean;
  isActive: boolean;
}

// ============ CUSTOM FORMULAS ============
export interface Formula {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  expression: string;
  variables: string[];
  category: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============ COUNTERPARTY (VENDORS/CUSTOMERS) ============
export interface Counterparty {
  id: string;
  orgId: string;
  name: string;
  type: "customer" | "vendor" | "both";
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  currency: string;
  paymentTermsDays: number;
  isActive: boolean;
  createdAt: string;
}



