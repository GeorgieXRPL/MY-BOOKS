# Codebase Index

## Overview

**MY-BOOKS** is a full-featured accounting system with crypto/fiat support, designed for in-house use with potential for SaaS monetization. Built with Node.js/Express backend and React/Vite frontend.

---

## Backend (`backend/`)

### Core Setup
- `package.json`, `tsconfig.json`: Node/TS setup and scripts
- `src/server.ts`: Starts HTTP server on port 4000
- `src/app.ts`: Wires middleware, routes, services, SQLite store, default COA seed
- `src/config.ts`: Env/config loading (PORT, JWT_SECRET, WEBHOOK_SECRET, DEFAULT_CURRENCY)

### Middleware (`src/middleware/`)
- `auth.ts`: JWT auth guard + role requirement helper (`requireRoles`)
- `audit.ts`: Request audit logging
- `hmac.ts`: Webhook HMAC verification

### Core Domain (`src/core/`)

#### Authentication & Security
- `auth.ts`: **NEW** - Full authentication service
  - User registration with bcrypt password hashing (12 rounds)
  - Login with JWT access tokens (15min) + refresh tokens (30 days)
  - Token rotation on refresh
  - Password change with session invalidation
  - Team invitation system
  - User role management

#### Data & Persistence
- `types.ts`: Shared domain types (roles, journals, invoices, expenses, payroll, crypto, assets, formulas)
- `store.db.ts`: SQLite-backed persistence including:
  - `users` table with password hashing
  - `refresh_tokens` for session management
  - `invitations` for team invites
  - All accounting entities (accounts, journals, invoices, etc.)
- `coa.ts`: Default crypto-aware chart of accounts seeding

#### Accounting Core
- `ledger.ts`: Draft→reviewed→posted workflow, validation, period locks, balances
- `controls.ts`: Treasury policy checks (limits/alerts/quorum)
- `close.ts`: Monthly close checklist seed/list/complete
- `reconciliation.ts`: Reconcile external vs ledger balances
- `reporting.ts`: Balance sheet, income statement, cash flow, treasury rollforward

#### Business Modules
- `invoices.ts`: AR/AP invoices with line items, status workflow, aging reports
- `expenses.ts`: Expense tracking with submit/approve/reject/pay workflow
- `payroll.ts`: Employee management, payroll runs, tax calculations, journal generation
- `bankTxns.ts`: Bank transactions with CSV import, categorization, splits
- `crypto.ts`: Crypto transactions, lot tracking (FIFO/LIFO/average), realized/unrealized gains

#### Ingestion (`core/ingestion/`)
- `pricing.ts`: Price fetch/value from CoinGecko
- `wallet.ts`: Wallet transaction ingestion
- `cex.ts`: CEX transaction ingestion
- `bank.ts`: Bank transaction ingestion

#### Security (`core/security/`)
- `rbac.ts`: Role-based access control
- `auditLog.ts`: Audit log service
- `mfa.ts`: MFA stub (TOTP ready)

#### Calculations (`core/calculations/`)
- `tax.ts`: Tax rates, calculations, GST/VAT summaries, BAS preview, income tax provision
- `depreciation.ts`: Asset management, depreciation schedules (straight-line, declining balance)
- `fx.ts`: FX rates, conversions, exposure reports, unrealized gain/loss
- `ratios.ts`: Financial ratios (liquidity, profitability, leverage, efficiency)
- `formulas.ts`: Custom formula builder with safe expression evaluator

### Routes (`src/routes/`)

#### Authentication (Public)
- `POST /security/auth/register` - Create account
- `POST /security/auth/login` - Login, get tokens
- `POST /security/auth/refresh` - Refresh access token
- `POST /security/auth/logout` - Invalidate refresh token

#### Authentication (Protected)
- `GET /security/auth/me` - Get current user
- `POST /security/auth/change-password` - Change password
- `POST /security/auth/logout-all` - Logout all devices

#### Team Management (Admin only)
- `GET /security/team` - List team members
- `POST /security/team/invite` - Invite user
- `PATCH /security/team/:userId/roles` - Update roles
- `POST /security/team/:userId/disable` - Disable user

#### Business Routes
- `ledger.ts`: Journals create/review/post, period locks, accounts list/create
- `invoices.ts`: Invoice CRUD, status updates, mark paid, aging report
- `expenses.ts`: Expense CRUD, submit/approve/reject/pay, category breakdown
- `payroll.ts`: Employees CRUD, payroll runs create/calculate/approve/finalize
- `bankTxns.ts`: Bank transactions CRUD, categorize, CSV import, split
- `crypto.ts`: Crypto transactions, lots, holdings, realized gain calculation
- `assets.ts`: Assets CRUD, depreciation schedule, record monthly depreciation
- `calculations.ts`: Tax rates/calculations, ratios dashboard, custom formulas
- `reporting.ts`: BS/IS/CF/treasury + reconciliations
- `close.ts`: Close checklist seed/list/complete
- `ingestion.ts`: Wallet/CEX/bank ingestion endpoints

### Utils (`src/utils/`)
- `id.ts`: UUID helper
- `logger.ts`: Winston logger
- `crypto.ts`: HMAC-SHA256 helper

---

## Frontend (`frontend/`)

### Setup
- `package.json`, `tsconfig.json`, `vite.config.ts`: Vite/React setup
- `index.html`: Entry HTML
- `src/main.tsx`: React entry point with Router
- `src/App.tsx`: Routing and layout with collapsible sidebar, user info display
- `src/styles.css`: Comprehensive styles for all pages

### Store (`src/store/`)
- `auth.ts`: Zustand auth store
  - User object (id, email, name, orgId, roles)
  - Access token + refresh token management
  - Auto-refresh on 401 responses
  - Login/register/logout actions

### Lib (`src/lib/`)
- `api.ts`: Axios client with auth header injection and token refresh interceptor
- `hmac.ts`: HMAC helper for webhook signatures

### Pages (`src/pages/`)

#### Authentication
- `AuthPage.tsx`: **UPDATED** - Beautiful login/register form with:
  - Email/password authentication
  - Form validation
  - Error display
  - Automatic redirect on login

#### Team Management
- `TeamPage.tsx`: **NEW** - Admin team management
  - List team members with roles
  - Invite new users
  - Edit user roles
  - Disable users

#### Dashboard & Core
- `DashboardPage.tsx`: Summary cards, AR/AP overview, quick actions
- `JournalsPage.tsx`: Manual journal entries with double-entry validation

#### Data Entry
- `InvoicesPage.tsx`: AR/AP invoices with line items
- `ExpensesPage.tsx`: Expense tracking with approval workflow
- `PayrollPage.tsx`: Employees and payroll runs
- `BankTxnsPage.tsx`: Bank transactions with CSV import
- `CryptoPage.tsx`: Crypto transactions, lots, holdings, gain calculation
- `AssetsPage.tsx`: Asset register and depreciation schedules

#### Reporting & Analysis
- `CalculationsPage.tsx`: Financial ratios, custom formulas, tax calculator
- `ReportsPage.tsx`: Balance Sheet, Income Statement, Cash Flow, Treasury
- `ReconClosePage.tsx`: Reconciliations and close checklist

#### System
- `IngestionPage.tsx`: Wallet/CEX/bank ingestion triggers
- `SettingsPage.tsx`: Org settings, chart of accounts, tax rates

---

## Security Features

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt (12 rounds) |
| Access tokens | JWT, 15-minute expiry |
| Refresh tokens | Random 64-byte, 30-day expiry, stored in DB |
| Token rotation | New refresh token on each refresh |
| RBAC | admin, poster, approver, viewer, auditor |
| Audit logging | All actions logged with actor, timestamp, before/after |
| Session management | Logout single device or all devices |

---

## User Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access, manage team, set policies |
| `poster` | Create and edit entries |
| `approver` | Review and approve transactions |
| `viewer` | Read-only access |
| `auditor` | View audit logs and reports |

---

## How to Run

### Backend
```bash
cd backend
npm install
cp ENV_EXAMPLE.txt .env
# Edit .env: set JWT_SECRET (64+ chars), WEBHOOK_SECRET
npm run dev
# Runs on http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
# Optional: cp ENV_EXAMPLE.txt .env (VITE_API_BASE_URL=http://localhost:4000)
npm run dev
# Runs on http://localhost:5173
```

### First Time Setup
1. Open http://localhost:5173
2. Click "Sign up" to create your account
3. Make yourself admin (see below)
4. Invite team members from Team page

**Make yourself admin:**
```bash
cd backend
node -e "
const Database = require('better-sqlite3');
const db = new Database('data.db');
db.prepare('UPDATE users SET roles = ? WHERE email = ?')
  .run('[\"admin\"]', 'your@email.com');
console.log('Done! You are now admin.');
"
```

---

## API Endpoints Summary

| Module | Endpoint | Methods |
|--------|----------|---------|
| Auth | `/security/auth/register` | POST |
| Auth | `/security/auth/login` | POST |
| Auth | `/security/auth/refresh` | POST |
| Auth | `/security/auth/me` | GET |
| Team | `/security/team` | GET |
| Team | `/security/team/invite` | POST |
| Journals | `/ledger/journals` | GET, POST |
| Accounts | `/ledger/accounts` | GET, POST |
| Invoices | `/invoices` | GET, POST |
| Expenses | `/expenses` | GET, POST |
| Payroll | `/payroll/employees`, `/payroll/runs` | GET, POST |
| Bank Txns | `/bank-txns` | GET, POST |
| Crypto | `/crypto/transactions`, `/crypto/lots` | GET, POST |
| Assets | `/assets` | GET, POST |
| Calculations | `/calc/ratios`, `/calc/formulas`, `/calc/tax` | GET, POST |
| Reports | `/reports/balance-sheet`, `/reports/income-statement` | GET |
| Close | `/close/checklist` | GET, POST |

---

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, SQLite (better-sqlite3), JWT, bcrypt
- **Frontend**: React 18, Vite, TypeScript, Zustand, Axios, React Router
- **Database**: SQLite with WAL mode
- **Auth**: JWT access tokens + refresh token rotation

---

## Deployment

### Live URLs
- **Backend API**: https://my-books-production.up.railway.app
- **Frontend**: *(Vercel URL here)*

See `DEPLOYMENT.md` for:
- VPS deployment (DigitalOcean, Linode)
- Docker Compose setup
- Vercel/Railway/Render options
- Security checklist
- Backup strategies
- Monetization setup (Stripe integration)
