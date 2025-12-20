import express from "express";
import cors from "cors";
import { config } from "./config";
import { logger } from "./utils/logger";
import { buildLedgerRouter } from "./routes/ledger";
import { buildIngestionRouter } from "./routes/ingestion";
import { buildReportingRouter } from "./routes/reporting";
import { buildSecurityRouter } from "./routes/security";
import { DbStore } from "./core/store.db";
import { PgStore } from "./db/store.pg";
import { runMigrations } from "./db/migrate";
import { AuditLogService } from "./core/security/auditLog";
import { RbacService } from "./core/security/rbac";
import { MfaService } from "./core/security/mfa";
import { ControlsService } from "./core/controls";
import { LedgerService } from "./core/ledger";
import { PricingService } from "./core/ingestion/pricing";
import { WalletIngestor } from "./core/ingestion/wallet";
import { CexIngestor } from "./core/ingestion/cex";
import { BankIngestor } from "./core/ingestion/bank";
import { ReconciliationService } from "./core/reconciliation";
import { ReportingService } from "./core/reporting";
import { authMiddleware, requireRoles } from "./middleware/auth";
import { auditMiddleware } from "./middleware/audit";
import { CloseService } from "./core/close";
import { buildCloseRouter } from "./routes/close";
import { AuthService } from "./core/auth";
import path from "path";

// New services
import { InvoiceService } from "./core/invoices";
import { ExpenseService } from "./core/expenses";
import { PayrollService } from "./core/payroll";
import { BankTxnService } from "./core/bankTxns";
import { CryptoService } from "./core/crypto";
import { TaxService } from "./core/calculations/tax";
import { DepreciationService } from "./core/calculations/depreciation";
import { RatioService } from "./core/calculations/ratios";
import { FormulaService } from "./core/calculations/formulas";
import { FXService } from "./core/calculations/fx";
import { AutoIngestService } from "./core/blockchain";

// New routes
import { buildInvoicesRouter } from "./routes/invoices";
import { buildExpensesRouter } from "./routes/expenses";
import { buildPayrollRouter } from "./routes/payroll";
import { buildBankTxnsRouter } from "./routes/bankTxns";
import { buildCryptoRouter } from "./routes/crypto";
import { buildAssetsRouter } from "./routes/assets";
import { buildCalculationsRouter } from "./routes/calculations";

const DEFAULT_ORG = "demo-org";

// Determine which database to use
const usePostgres = !!process.env.DATABASE_URL;

export const buildApp = async () => {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  // Use 'any' type for store to support both SQLite and PostgreSQL
  // Both stores implement the same interface but have different implementations
  let store: any;

  if (usePostgres) {
    logger.info("Using PostgreSQL database");
    // Run migrations first
    await runMigrations();
    // Create PostgreSQL store
    const pgStore = new PgStore(process.env.DATABASE_URL!, DEFAULT_ORG, config.defaultCurrency);
    await pgStore.initialize();
    store = pgStore;
  } else {
    logger.info("Using SQLite database");
    store = new DbStore("data.db", DEFAULT_ORG, config.defaultCurrency);
  }

  // Core services
  const audit = new AuditLogService(store);
  const rbac = new RbacService(store);
  const controls = new ControlsService(store);
  const ledger = new LedgerService(store, audit);
  const pricing = new PricingService(store);
  const wallet = new WalletIngestor(store, pricing, ledger);
  const cex = new CexIngestor(store, pricing, ledger);
  const bankIngest = new BankIngestor(store, ledger);
  const recon = new ReconciliationService(store);
  const reporting = new ReportingService(store, ledger);
  const mfa = new MfaService();
  const close = new CloseService(store);
  const auth = new AuthService(store, DEFAULT_ORG);

  // New services
  const invoices = new InvoiceService(store, audit);
  const expenses = new ExpenseService(store, audit);
  const payroll = new PayrollService(store, audit, ledger);
  const bankTxns = new BankTxnService(store, audit);
  const crypto = new CryptoService(store, audit);
  const tax = new TaxService(store);
  const depreciation = new DepreciationService(store, ledger);
  const ratios = new RatioService(store, reporting);
  const formulas = new FormulaService(store, reporting);
  const fx = new FXService(store, config.defaultCurrency);
  
  // Blockchain auto-ingestion service
  const autoIngest = new AutoIngestService(store, pricing, ledger);

  // Static UI (login/token helper) served before auth
  const publicDir = path.join(process.cwd(), "public");
  app.use(express.static(publicDir));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Security routes (auth is public, other routes protected)
  app.use("/security", buildSecurityRouter(auth, rbac, mfa, audit, controls));

  app.use(authMiddleware(rbac));
  app.use(auditMiddleware(audit));

  // Existing routes
  app.use("/ledger", buildLedgerRouter(ledger, store));
  app.use("/ingest", buildIngestionRouter(wallet, cex, bankIngest, autoIngest));
  app.use("/reports", buildReportingRouter(reporting, recon));
  app.use("/close", buildCloseRouter(close));

  // New routes
  app.use("/invoices", buildInvoicesRouter(invoices, store));
  app.use("/expenses", buildExpensesRouter(expenses));
  app.use("/payroll", buildPayrollRouter(payroll));
  app.use("/bank-txns", buildBankTxnsRouter(bankTxns));
  app.use("/crypto", buildCryptoRouter(crypto));
  app.use("/assets", buildAssetsRouter(depreciation));
  app.use("/calc", buildCalculationsRouter(tax, ratios, formulas, fx));

  app.get("/recon/sample", requireRoles(["viewer", "admin"]), (_req, res) => {
    const items = recon.list(DEFAULT_ORG);
    res.json(items);
  });

  logger.info(`App wired with ${usePostgres ? "PostgreSQL" : "SQLite"} store and all modules`);
  return app;
};
