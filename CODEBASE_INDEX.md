# Codebase Index

## Overview

This is a **full-stack accounting and financial reporting application** designed for organizations dealing with both traditional finance and cryptocurrency assets. It provides wallet-aware bookkeeping, reconciliations, financial reporting (Balance Sheet, Income Statement, Cash Flow, Treasury), and integrations with banks, CEX (centralized exchanges), and blockchain wallets.

---

## Current Status

### ✅ Async/Sync Migration Complete

**Status:** All backend services have been refactored to support both synchronous (SQLite) and asynchronous (PostgreSQL) database operations.

**Pattern Used:** All service methods are now `async` and wrap store calls with `await Promise.resolve()`.

**Interface:** A new `IStore` interface (`backend/src/core/store.interface.ts`) defines all data access methods.

### ✅ What's Working
- Authentication (register, login, token refresh)
- All CRUD operations (Journals, Invoices, Expenses, etc.)
- Financial reporting (Balance Sheet, Income Statement, Treasury)
- Crypto tracking (Transactions, Lots, Cost Basis)
- Payroll management
- Asset depreciation
- OCR invoice scanning
- Blockchain transaction lookup
- Frontend navigation (no crashes)
- Database connection to Supabase
- CORS configuration

### 📋 Ready for Testing
- Deploy to Render and verify all endpoints
- Test complete user workflows
- See `ASYNC_REFACTOR_PLAN.md` for testing checklist

---

## Tech Stack

| Layer     | Technology                                   |
|-----------|----------------------------------------------|
| Frontend  | React 18, TypeScript, Vite, React Router 6   |
| State     | Zustand                                      |
| API       | Axios (with token refresh interceptors)      |
| Backend   | Node.js, Express, TypeScript                 |
| Database  | **PostgreSQL** (Supabase) or SQLite (dev)    |
| ORM       | Drizzle ORM (for PostgreSQL)                 |
| Auth      | JWT (access + refresh tokens), bcryptjs      |
| Security  | RBAC, MFA (TOTP), HMAC webhooks, Audit logs  |

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── app.ts              # Express app setup, dependency injection
│   │   ├── server.ts           # HTTP server entry point
│   │   ├── config.ts           # Environment configuration
│   │   ├── core/               # Business logic services
│   │   ├── db/                 # Database layer (PostgreSQL/Drizzle)
│   │   ├── middleware/         # Express middleware
│   │   ├── routes/             # API route handlers
│   │   └── utils/              # Utility functions
│   └── public/                 # Static files (login helper page)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Main app with routing and layout
│   │   ├── main.tsx            # React entry point
│   │   ├── pages/              # Page components
│   │   ├── lib/                # API client and utilities
│   │   ├── store/              # Zustand state stores
│   │   └── styles.css          # Global styles
│   └── vite.config.ts          # Vite bundler configuration
│
├── Scope & Objectives.md       # Project requirements document
├── CODEBASE_INDEX.md           # This file
├── DEPLOYMENT.md               # Deployment guide (Render, Supabase, Vercel)
├── ISSUES_AND_LESSONS.md       # Known issues and lessons learned
└── ASYNC_REFACTOR_PLAN.md      # Plan for async service migration
```

---

## Backend Architecture

### Entry Points

| File              | Purpose                                        |
|-------------------|------------------------------------------------|
| `server.ts`       | Starts HTTP server on configured port          |
| `app.ts`          | Wires Express app with all services and routes |
| `config.ts`       | Loads environment variables (port, JWT secret) |

### Core Services (`/core`)

| Service                  | File                        | Description                                             |
|--------------------------|-----------------------------|---------------------------------------------------------|
| **AuthService**          | `auth.ts`                   | User registration, login, JWT tokens, team management   |
| **LedgerService**        | `ledger.ts`                 | Double-entry journal posting, balances, period locks    |
| **ReportingService**     | `reporting.ts`              | Balance Sheet, Income Statement, Cash Flow, Treasury    |
| **ReconciliationService**| `reconciliation.ts`         | Bank/wallet/CEX reconciliation with ledger              |
| **CloseService**         | `close.ts`                  | Period close checklist and lock management              |
| **ControlsService**      | `controls.ts`               | Treasury policy enforcement (spending limits, alerts)   |
| **InvoiceService**       | `invoices.ts`               | AR/AP invoice management                                |
| **ExpenseService**       | `expenses.ts`               | Expense tracking and approval workflow                  |
| **PayrollService**       | `payroll.ts`                | Employee payroll runs and calculations                  |
| **BankTxnService**       | `bankTxns.ts`               | Bank transaction import and categorization              |
| **CryptoService**        | `crypto.ts`                 | Crypto transaction tracking, lot accounting             |
| **CoA (Chart of Accounts)** | `coa.ts`                 | Default crypto-aware chart of accounts                  |

### Ingestion Services (`/core/ingestion`)

| Service            | File          | Description                                  |
|--------------------|---------------|----------------------------------------------|
| **PricingService** | `pricing.ts`  | Token/FX price feeds (CoinGecko, Coinbase)   |
| **WalletIngestor** | `wallet.ts`   | On-chain wallet transaction ingestion        |
| **CexIngestor**    | `cex.ts`      | CEX (Coinbase, Binance, etc.) data import    |
| **BankIngestor**   | `bank.ts`     | Bank statement CSV/API import                |

### Blockchain Auto-Ingestion (`/core/blockchain`)

| Service              | File              | Description                                    |
|----------------------|-------------------|------------------------------------------------|
| **AutoIngestService**| `autoIngest.ts`   | Orchestrates TX lookup, pricing, journal creation |
| **Chain Detector**   | `detector.ts`     | Auto-detect blockchain from TX hash format     |
| **EVM Fetcher**      | `fetchers/evm.ts` | Ethereum, Polygon, Arbitrum, Base via Alchemy  |
| **XRPL Fetcher**     | `fetchers/xrpl.ts`| XRP Ledger transaction fetching                |
| **Solana Fetcher**   | `fetchers/solana.ts` | Solana via Helius or public RPC             |
| **Bitcoin Fetcher**  | `fetchers/bitcoin.ts` | Bitcoin via Blockstream/Mempool.space       |

**API Endpoints:**
- `POST /ingest/blockchain/lookup` - Preview transaction details
- `POST /ingest/blockchain/detect` - Detect chain from hash format
- `POST /ingest/blockchain/ingest` - Fetch TX and create journal entry

### OCR Invoice Scanning (`/core/ocr`)

| Service        | File          | Description                                    |
|----------------|---------------|------------------------------------------------|
| **OCRService** | `service.ts`  | Main service orchestrating upload + extraction |
| **Upload**     | `upload.ts`   | File upload to Cloudflare R2 (with local fallback) |
| **Extract**    | `extract.ts`  | OpenAI Vision API for invoice data extraction  |

**API Endpoints:**
- `GET /invoices/ocr/status` - Check OCR configuration status
- `POST /invoices/ocr/scan` - Upload image and extract invoice data
- `POST /invoices/ocr/create-from-extracted` - Create invoice from extracted data

**Supported Formats:** JPG, PNG, WebP (max 10MB)

### Admin Module (`/admin`)

| Service            | File              | Description                                    |
|--------------------|-------------------|------------------------------------------------|
| **Admin Routes**   | `routes.ts`       | Protected admin-only API endpoints             |
| **Metrics**        | `metrics.ts`      | Request tracking and system health metrics     |
| **Impersonation**  | `impersonate.ts`  | Admin user impersonation for debugging         |
| **Middleware**     | `middleware.ts`   | Request metrics collection middleware          |

**API Endpoints:**
- `GET /admin/health` - System health information
- `GET /admin/metrics` - Detailed request/error metrics
- `GET /admin/users` - List all users
- `PATCH /admin/users/:id` - Update user (roles, active status)
- `POST /admin/impersonate` - Start impersonation session
- `GET /admin/audit/search` - Search audit logs
- `GET /admin/feature-flags` - List feature flags
- `PATCH /admin/feature-flags/:flag` - Toggle feature flag
- `GET /admin/db/stats` - Database statistics

**Security:** Admin routes require "admin" role and optionally IP allowlist (via `ADMIN_IP_ALLOWLIST` env var)

### AI Chatbot (`/core/ai`)

| Service            | File           | Description                                    |
|--------------------|----------------|------------------------------------------------|
| **ChatService**    | `chat.ts`      | Main chat completion with OpenAI GPT-4         |
| **FunctionExecutor** | `executor.ts`| Executes function calls from AI               |
| **Functions**      | `functions.ts` | Available function definitions                 |

**API Endpoints:**
- `GET /chat/status` - Check if chatbot is configured
- `POST /chat/message` - Send a chat message
- `GET /chat/prompts` - Get suggested prompts

**Capabilities:**
- Query account balances and transactions
- List and analyze invoices
- Get financial summaries
- Explain transactions and reports
- Calculate financial ratios
- Suggest account mappings
- Query crypto holdings

**Frontend:** Floating chat widget accessible on all pages (bottom-right corner)

### Security Middleware (`/middleware/security.ts`)

| Middleware         | Description                                         |
|--------------------|-----------------------------------------------------|
| **Helmet**         | Security headers (CSP, HSTS, XSS protection)        |
| **Rate Limiting**  | General (100/15min), Auth (10/hour), Upload (20/hour) |
| **CORS**           | Origin allowlist via `ALLOWED_ORIGINS` env var      |
| **API Key Auth**   | Programmatic access via `X-API-Key` header          |
| **Request Sanitization** | Remove dangerous characters from inputs       |
| **Error Sanitization** | Don't leak stack traces in production           |

**Security Features:**
- Helmet.js for security headers
- Rate limiting on all endpoints
- Stricter rate limiting on auth endpoints
- CORS with origin allowlist
- API key authentication for programmatic access
- Input sanitization
- Request ID tracking

### Scalability (`/utils`)

| Utility            | File             | Description                                    |
|--------------------|------------------|------------------------------------------------|
| **Cache**          | `cache.ts`       | Redis caching with in-memory fallback          |
| **Pagination**     | `pagination.ts`  | Standard and cursor-based pagination           |

**Caching:**
- Redis/Upstash for distributed caching
- In-memory fallback when Redis unavailable
- 5-minute TTL for financial reports
- Cache invalidation on data changes

**Pagination:**
- Standard offset-based: `?page=1&limit=20`
- Cursor-based for large datasets: `?cursor=xxx&limit=20`
- Default 20 items, max 200 per page

**Environment Variables:**
- `UPSTASH_REDIS_URL` or `REDIS_URL` for Redis connection

### Calculation Services (`/core/calculations`)

| Service                | File              | Description                              |
|------------------------|-------------------|------------------------------------------|
| **TaxService**         | `tax.ts`          | Tax rate management and calculations     |
| **DepreciationService**| `depreciation.ts` | Asset depreciation (straight-line, etc.) |
| **RatioService**       | `ratios.ts`       | Financial ratio calculations             |
| **FormulaService**     | `formulas.ts`     | Custom formula definitions               |
| **FXService**          | `fx.ts`           | Foreign exchange rate management         |

### Security Services (`/core/security`)

| Service            | File           | Description                                 |
|--------------------|----------------|---------------------------------------------|
| **RbacService**    | `rbac.ts`      | Role-based access control                   |
| **MfaService**     | `mfa.ts`       | TOTP-based multi-factor authentication      |
| **AuditLogService**| `auditLog.ts`  | Immutable audit trail for all mutations     |

### Data Store

| File                | Description                                     |
|---------------------|-------------------------------------------------|
| `core/store.ts`     | In-memory store (for development/testing)       |
| `core/store.db.ts`  | SQLite-backed persistent store                  |
| `db/store.pg.ts`    | **PostgreSQL store (production/Supabase)**      |
| `db/schema.ts`      | Drizzle ORM schema definitions                  |
| `db/client.ts`      | PostgreSQL connection pool with IPv4 resolution |
| `db/migrate.ts`     | Database migration runner with IPv4 resolution  |

**Database Selection:** The app automatically uses PostgreSQL if `DATABASE_URL` is set, otherwise falls back to SQLite.

**IPv4 Compatibility:** The database client includes automatic IPv4 DNS resolution to work with platforms like Render that don't support IPv6 outbound connections. When connecting:
1. The hostname is extracted from the connection string
2. DNS lookup forces IPv4 with `dns.lookup(hostname, { family: 4 })`
3. The resolved IPv4 address is used for the connection

**Important:** When using Supabase, you must use the **Session Pooler** connection string (hostname: `aws-0-xxx.pooler.supabase.com`), NOT the Direct Connection (hostname: `db.xxx.supabase.co`) which is IPv6-only.

### Middleware (`/middleware`)

| Middleware        | File        | Description                               |
|-------------------|-------------|-------------------------------------------|
| `authMiddleware`  | `auth.ts`   | JWT token validation, attaches user       |
| `auditMiddleware` | `audit.ts`  | Logs API actions to audit trail           |
| `hmacMiddleware`  | `hmac.ts`   | HMAC-SHA256 webhook signature validation  |

### API Routes (`/routes`)

| Route        | File              | Endpoints                                    |
|--------------|-------------------|----------------------------------------------|
| `/security`  | `security.ts`     | Auth (login, register, refresh), RBAC, MFA   |
| `/ledger`    | `ledger.ts`       | Accounts, wallets, journals, balances        |
| `/ingest`    | `ingestion.ts`    | Wallet, CEX, bank data ingestion             |
| `/reports`   | `reporting.ts`    | BS, IS, CF, treasury reports                 |
| `/close`     | `close.ts`        | Period close and checklist                   |
| `/invoices`  | `invoices.ts`     | Invoice CRUD                                 |
| `/expenses`  | `expenses.ts`     | Expense CRUD and approval                    |
| `/payroll`   | `payroll.ts`      | Payroll runs                                 |
| `/bank-txns` | `bankTxns.ts`     | Bank transaction management                  |
| `/crypto`    | `crypto.ts`       | Crypto transactions and lots                 |
| `/assets`    | `assets.ts`       | Fixed assets and depreciation                |
| `/calc`      | `calculations.ts` | Tax, ratios, formulas, FX                    |

---

## Frontend Architecture

### Main Components

| File            | Description                                     |
|-----------------|-------------------------------------------------|
| `App.tsx`       | Root component with sidebar layout and routing  |
| `main.tsx`      | React DOM entry point                           |

### Pages (`/pages`)

| Page                | Description                                    |
|---------------------|------------------------------------------------|
| `AuthPage`          | Login and registration                         |
| `DashboardPage`     | Overview dashboard                             |
| `InvoicesPage`      | Invoice management (AR/AP)                     |
| `ExpensesPage`      | Expense tracking                               |
| `PayrollPage`       | Payroll runs                                   |
| `BankTxnsPage`      | Bank transaction categorization                |
| `CryptoPage`        | Crypto transaction tracking                    |
| `JournalsPage`      | Manual journal entries                         |
| `AssetsPage`        | Fixed asset management                         |
| `CalculationsPage`  | Tax, depreciation, ratios, formulas            |
| `ReportsPage`       | Financial reports (BS, IS, CF, Treasury)       |
| `ReconClosePage`    | Reconciliation and period close                |
| `IngestionPage`     | Data import (wallets, CEX, banks)              |
| `TeamPage`          | Team member management (admin only)            |
| `SettingsPage`      | User and org settings                          |

### State Management (`/store`)

| Store        | File       | Description                               |
|--------------|------------|-------------------------------------------|
| `useAuthStore` | `auth.ts` | User session, tokens, login/logout       |

### API Client (`/lib`)

| File       | Description                                       |
|------------|---------------------------------------------------|
| `api.ts`   | Axios instance with auth interceptors             |
| `hmac.ts`  | HMAC signature generation for webhooks            |

---

## Data Model

### Core Types (defined in `backend/src/core/types.ts`)

| Type                  | Description                                       |
|-----------------------|---------------------------------------------------|
| `Account`             | Chart of accounts entry (Asset/Liability/etc.)    |
| `Wallet`              | Wallet/bank account (treasury, ops, cex, bank)    |
| `JournalEntry`        | Double-entry journal with lines                   |
| `JournalLine`         | Individual debit/credit line                      |
| `PriceTick`           | Token price at a point in time                    |
| `FXRate`              | Foreign exchange rate                             |
| `ReconciliationItem`  | Ledger vs external balance reconciliation         |
| `AuditLogEntry`       | Immutable audit trail record                      |
| `PeriodLock`          | Locked accounting period                          |
| `ChecklistItem`       | Period close checklist item                       |
| `TreasuryPolicy`      | Spending limits and signer requirements           |
| `Invoice`             | AR/AP invoice with line items                     |
| `Expense`             | Expense with approval workflow                    |
| `PayrollRun`          | Payroll batch with employee lines                 |
| `Employee`            | Employee record                                   |
| `BankTransaction`     | Imported bank transaction                         |
| `CryptoTransaction`   | On-chain or CEX crypto transaction                |
| `CryptoLot`           | FIFO/LIFO cost basis tracking                     |
| `Asset`               | Fixed asset for depreciation                      |
| `DepreciationEntry`   | Monthly depreciation record                       |
| `TaxRate`             | Tax rate configuration                            |
| `Formula`             | Custom calculation formula                        |
| `Counterparty`        | Vendor or customer                                |

### Roles

| Role       | Permissions                                        |
|------------|----------------------------------------------------|
| `admin`    | Full access, team management, settings             |
| `approver` | Review and approve journals/expenses               |
| `poster`   | Create and post journal entries                    |
| `viewer`   | Read-only access                                   |
| `auditor`  | Read access including audit logs                   |

---

## Key Workflows

### Authentication Flow
1. User registers/logs in → receives access token (15min) + refresh token (30 days)
2. Frontend stores tokens in Zustand state
3. API requests include `Authorization: Bearer <accessToken>`
4. On 401, frontend automatically refreshes tokens
5. Refresh token rotation on each use

### Journal Entry Flow
1. Create journal entry in "draft" status
2. Add debit/credit lines (must balance)
3. Approver reviews → status becomes "reviewed"
4. Poster posts → status becomes "posted"
5. Audit log records all state changes

### Reconciliation Flow
1. Ingest external data (bank/CEX/wallet)
2. System calculates ledger balance for account
3. Compare external vs ledger balance
4. Flag unmatched items for investigation
5. Mark as matched or create adjusting entries

### Period Close Flow
1. Complete checklist items (bank recs, journal reviews, etc.)
2. Generate reports for period
3. Lock period → prevents further posting
4. Audit trail captures who locked and when

---

## Environment Configuration

### Backend (`backend/.env`)

| Variable          | Description                   | Default      |
|-------------------|-------------------------------|--------------|
| `PORT`            | API server port               | 4000         |
| `JWT_SECRET`      | JWT signing secret            | dev-secret   |
| `WEBHOOK_SECRET`  | HMAC webhook secret           | webhook-secret |
| `PRICE_PROVIDER`  | Price feed provider           | coingecko    |
| `DEFAULT_CURRENCY`| Base currency                 | USD          |

### Frontend (`frontend/.env`)

| Variable            | Description              | Default                 |
|---------------------|--------------------------|-------------------------|
| `VITE_API_BASE_URL` | Backend API URL          | http://localhost:4000   |

---

## Running the Application

### Backend
```bash
cd backend
npm install
npm run dev    # Development with hot reload
npm run build  # Compile TypeScript
npm start      # Run compiled code
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # Vite dev server (port 5173)
npm run build  # Production build
npm run preview # Preview production build
```

---

## Deployment

| Component | Service | Configuration |
|-----------|---------|---------------|
| **Database** | Supabase | PostgreSQL (free tier) |
| **Backend** | Render | See environment variables below |
| **Frontend** | Vercel | `vercel.json` |
| **Cache** | Upstash | Redis (optional) |
| **File Storage** | Cloudflare R2 | For OCR uploads (optional) |

See `DEPLOYMENT.md` for detailed step-by-step deployment instructions.

### Quick Deploy Checklist

1. Create Supabase project → Get `DATABASE_URL`
2. Deploy backend to Render → Add environment variables
3. Deploy frontend to Vercel → Set `VITE_API_BASE_URL`
4. Update `ALLOWED_ORIGINS` on Render with Vercel URL





