import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { logger } from "../utils/logger";
import dns from "dns";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

// Resolve hostname to IPv4 address (Render free tier doesn't support IPv6 outbound)
async function resolveHostToIPv4(hostname: string): Promise<string> {
  try {
    const result = await dnsLookup(hostname, { family: 4 });
    logger.info(`Resolved ${hostname} to ${result.address} (IPv4)`);
    return result.address;
  } catch (error) {
    logger.warn(`Failed to resolve ${hostname} to IPv4, using original hostname`, error);
    return hostname;
  }
}

/**
 * Run database migrations
 * This creates all tables defined in the schema
 */
export async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Parse connection string and resolve hostname to IPv4
  const url = new URL(connectionString);
  const hostname = url.hostname;
  const port = parseInt(url.port) || 5432;
  const database = url.pathname.slice(1);
  const user = url.username;
  const password = decodeURIComponent(url.password);
  
  logger.info(`Connecting to PostgreSQL at ${hostname}:${port}/${database}`);
  
  // Resolve hostname to IPv4 to avoid IPv6 issues on Render
  const resolvedHost = await resolveHostToIPv4(hostname);
  
  const pool = new Pool({
    host: resolvedHost,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    logger.info("Running database migrations...");
    
    // Create tables directly from schema (push mode)
    // In production, you'd use proper migrations
    await createTablesFromSchema(pool);
    
    logger.info("Database migrations completed successfully");
  } catch (error) {
    logger.error("Migration failed", error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function createTablesFromSchema(pool: Pool) {
  const client = await pool.connect();
  
  try {
    // Create all tables
    const createTableStatements = `
      -- Accounts
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        currency TEXT NOT NULL,
        tags TEXT,
        metadata TEXT,
        is_active BOOLEAN DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS accounts_org_id_idx ON accounts(org_id);

      -- Wallets
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        address TEXT NOT NULL,
        chain TEXT,
        label TEXT NOT NULL,
        purpose TEXT NOT NULL,
        currency TEXT
      );
      CREATE INDEX IF NOT EXISTS wallets_org_id_idx ON wallets(org_id);

      -- Journals
      CREATE TABLE IF NOT EXISTS journals (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        status TEXT NOT NULL,
        period TEXT NOT NULL,
        created_by TEXT NOT NULL,
        reviewed_by TEXT,
        posted_by TEXT,
        memo TEXT,
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        external_ref TEXT
      );
      CREATE INDEX IF NOT EXISTS journals_org_id_idx ON journals(org_id);
      CREATE INDEX IF NOT EXISTS journals_period_idx ON journals(period);

      -- Journal Lines
      CREATE TABLE IF NOT EXISTS journal_lines (
        id TEXT PRIMARY KEY,
        journal_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        currency TEXT NOT NULL,
        description TEXT,
        wallet_id TEXT,
        token_symbol TEXT,
        fx_rate REAL,
        external_ref TEXT,
        tx_hash TEXT
      );
      CREATE INDEX IF NOT EXISTS journal_lines_journal_id_idx ON journal_lines(journal_id);

      -- Price Ticks
      CREATE TABLE IF NOT EXISTS price_ticks (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        currency TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS price_ticks_symbol_currency_idx ON price_ticks(symbol, currency);

      -- FX Rates
      CREATE TABLE IF NOT EXISTS fx_rates (
        id TEXT PRIMARY KEY,
        base TEXT NOT NULL,
        quote TEXT NOT NULL,
        rate REAL NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL
      );

      -- Reconciliations
      CREATE TABLE IF NOT EXISTS reconciliations (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        source TEXT NOT NULL,
        external_ref TEXT NOT NULL,
        external_balance REAL NOT NULL,
        ledger_balance REAL NOT NULL,
        delta REAL NOT NULL,
        status TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS reconciliations_org_id_idx ON reconciliations(org_id);

      -- Audit Logs
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        before TEXT,
        after TEXT,
        timestamp TEXT NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS audit_logs_org_id_idx ON audit_logs(org_id);
      CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON audit_logs(timestamp);

      -- Period Locks
      CREATE TABLE IF NOT EXISTS period_locks (
        org_id TEXT NOT NULL,
        period TEXT NOT NULL,
        locked_by TEXT NOT NULL,
        locked_at TEXT NOT NULL,
        UNIQUE(org_id, period)
      );

      -- Checklist
      CREATE TABLE IF NOT EXISTS checklist (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        period TEXT NOT NULL,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT false,
        completed_by TEXT,
        completed_at TEXT
      );

      -- Roles
      CREATE TABLE IF NOT EXISTS roles (
        user_id TEXT PRIMARY KEY,
        roles TEXT NOT NULL
      );

      -- Policies
      CREATE TABLE IF NOT EXISTS policies (
        org_id TEXT PRIMARY KEY,
        max_single_spend REAL NOT NULL,
        large_tx_alert_threshold REAL NOT NULL,
        min_signer_quorum REAL NOT NULL
      );

      -- Counterparties
      CREATE TABLE IF NOT EXISTS counterparties (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        tax_id TEXT,
        currency TEXT NOT NULL,
        payment_terms_days INTEGER DEFAULT 30,
        is_active BOOLEAN DEFAULT true,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS counterparties_org_id_idx ON counterparties(org_id);

      -- Invoices
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        type TEXT NOT NULL,
        counterparty_id TEXT NOT NULL,
        counterparty_name TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax_amount REAL NOT NULL,
        total REAL NOT NULL,
        currency TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL,
        paid_date TEXT,
        paid_amount REAL,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS invoices_org_id_idx ON invoices(org_id);
      CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);

      -- Invoice Lines
      CREATE TABLE IF NOT EXISTS invoice_lines (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        account_id TEXT NOT NULL,
        tax_rate REAL NOT NULL,
        amount REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS invoice_lines_invoice_id_idx ON invoice_lines(invoice_id);

      -- Expenses
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        category TEXT NOT NULL,
        vendor TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        date TEXT NOT NULL,
        receipt_url TEXT,
        reimbursable BOOLEAN DEFAULT false,
        status TEXT NOT NULL,
        paid_by TEXT NOT NULL,
        approved_by TEXT,
        approved_at TEXT,
        account_id TEXT NOT NULL,
        tax_amount REAL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS expenses_org_id_idx ON expenses(org_id);

      -- Employees
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        position TEXT NOT NULL,
        base_salary REAL NOT NULL,
        currency TEXT NOT NULL,
        tax_id TEXT,
        bank_account TEXT,
        start_date TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS employees_org_id_idx ON employees(org_id);

      -- Payroll Runs
      CREATE TABLE IF NOT EXISTS payroll_runs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        period TEXT NOT NULL,
        total_gross REAL NOT NULL,
        total_tax REAL NOT NULL,
        total_deductions REAL NOT NULL,
        total_net REAL NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL,
        approved_by TEXT,
        approved_at TEXT,
        finalized_by TEXT,
        finalized_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS payroll_runs_org_id_idx ON payroll_runs(org_id);

      -- Payroll Lines
      CREATE TABLE IF NOT EXISTS payroll_lines (
        id TEXT PRIMARY KEY,
        payroll_run_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        employee_name TEXT NOT NULL,
        gross_pay REAL NOT NULL,
        tax_withholding REAL NOT NULL,
        other_deductions REAL NOT NULL,
        net_pay REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS payroll_lines_payroll_run_id_idx ON payroll_lines(payroll_run_id);

      -- Bank Transactions
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        bank_account_id TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT,
        account_id TEXT,
        status TEXT NOT NULL,
        external_ref TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS bank_transactions_org_id_idx ON bank_transactions(org_id);

      -- Crypto Transactions
      CREATE TABLE IF NOT EXISTS crypto_transactions (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        type TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        quantity REAL NOT NULL,
        price_usd REAL NOT NULL,
        value_usd REAL NOT NULL,
        fee_usd REAL NOT NULL,
        timestamp TEXT NOT NULL,
        from_address TEXT,
        to_address TEXT,
        swap_to_token TEXT,
        swap_to_qty REAL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS crypto_transactions_org_id_idx ON crypto_transactions(org_id);
      CREATE INDEX IF NOT EXISTS crypto_transactions_tx_hash_idx ON crypto_transactions(tx_hash);

      -- Crypto Lots
      CREATE TABLE IF NOT EXISTS crypto_lots (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        quantity REAL NOT NULL,
        cost_basis_usd REAL NOT NULL,
        acquired_at TEXT NOT NULL,
        txn_id TEXT NOT NULL,
        remaining_qty REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS crypto_lots_org_id_token_idx ON crypto_lots(org_id, token_symbol);

      -- Assets
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        purchase_date TEXT NOT NULL,
        cost REAL NOT NULL,
        salvage_value REAL NOT NULL,
        useful_life_months INTEGER NOT NULL,
        depreciation_method TEXT NOT NULL,
        account_id TEXT NOT NULL,
        depreciation_account_id TEXT NOT NULL,
        currency TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS assets_org_id_idx ON assets(org_id);

      -- Depreciation Entries
      CREATE TABLE IF NOT EXISTS depreciation_entries (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        period TEXT NOT NULL,
        amount REAL NOT NULL,
        accumulated_depreciation REAL NOT NULL,
        book_value REAL NOT NULL,
        journal_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS depreciation_entries_asset_id_idx ON depreciation_entries(asset_id);

      -- Tax Rates
      CREATE TABLE IF NOT EXISTS tax_rates (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        rate REAL NOT NULL,
        type TEXT NOT NULL,
        jurisdiction TEXT,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS tax_rates_org_id_idx ON tax_rates(org_id);

      -- Formulas
      CREATE TABLE IF NOT EXISTS formulas (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        expression TEXT NOT NULL,
        variables TEXT NOT NULL,
        category TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS formulas_org_id_idx ON formulas(org_id);

      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        org_id TEXT NOT NULL,
        roles TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      );
      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
      CREATE INDEX IF NOT EXISTS users_org_id_idx ON users(org_id);

      -- Refresh Tokens
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      );
      CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON refresh_tokens(token);
      CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);

      -- Invitations
      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        email TEXT NOT NULL,
        roles TEXT NOT NULL,
        invited_by TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS invitations_org_id_idx ON invitations(org_id);
      CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations(email);
    `;

    await client.query(createTableStatements);
    logger.info("All tables created successfully");
  } finally {
    client.release();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  require("dotenv").config();
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
