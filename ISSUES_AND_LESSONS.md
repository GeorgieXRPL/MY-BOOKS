# Issues Encountered & Lessons Learned

This document captures the issues we faced during development and deployment, along with solutions and preventive measures for future development.

---

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [Deployment Issues](#deployment-issues)
3. [Architecture Decisions](#architecture-decisions)
4. [Technical Debt](#technical-debt)
5. [Recommendations](#recommendations)

---

## Critical Issues

### Issue 1: Async/Sync Mismatch Between Stores

**Severity:** Critical  
**Status:** ✅ FULLY FIXED (All services)  
**Affects:** All backend services using PgStore

**Problem:**
The codebase was originally written for SQLite using `DbStore`, which has **synchronous** methods:
```typescript
// DbStore (SQLite) - SYNCHRONOUS
getUserByEmail(email: string): User | undefined {
  return this.db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}
```

When we migrated to PostgreSQL using `PgStore`, all methods became **asynchronous**:
```typescript
// PgStore (PostgreSQL) - ASYNCHRONOUS
async getUserByEmail(email: string): Promise<User | undefined> {
  const rows = await this.db.select().from(schema.users).where(...);
  return rows[0];
}
```

**Symptom:**
Services calling store methods without `await` receive Promise objects instead of actual data:
```typescript
// BUG: user is a Promise, not a User object!
const user = this.store.getUserByEmail(email);
if (user) {  // Always true - Promise is truthy!
  // Wrong behavior
}
```

**Affected Services (ALL NOW FIXED):**
| Service | File | Status |
|---------|------|--------|
| AuthService | `core/auth.ts` | ✅ Fixed |
| LedgerService | `core/ledger.ts` | ✅ Fixed |
| ReportingService | `core/reporting.ts` | ✅ Fixed |
| InvoiceService | `core/invoices.ts` | ✅ Fixed |
| ExpenseService | `core/expenses.ts` | ✅ Fixed |
| PayrollService | `core/payroll.ts` | ✅ Fixed |
| BankTxnService | `core/bankTxns.ts` | ✅ Fixed |
| CryptoService | `core/crypto.ts` | ✅ Fixed |
| ReconciliationService | `core/reconciliation.ts` | ✅ Fixed |
| CloseService | `core/close.ts` | ✅ Fixed |
| ControlsService | `core/controls.ts` | ✅ Fixed |
| RatioService | `core/calculations/ratios.ts` | ✅ Fixed |
| FormulaService | `core/calculations/formulas.ts` | ✅ Fixed |
| DepreciationService | `core/calculations/depreciation.ts` | ✅ Fixed |
| AuditLogService | `core/security/auditLog.ts` | ✅ Fixed |
| RbacService | `core/security/rbac.ts` | ✅ Fixed |
| OCRService | `core/ocr/service.ts` | ✅ Fixed |
| All Ingestors | `core/ingestion/*.ts` | ✅ Fixed |

**Solution Pattern:**
Wrap all store method calls with `await Promise.resolve()`:
```typescript
// Before (sync style)
const user = this.store.getUserByEmail(email);

// After (works with both sync and async)
const user = await Promise.resolve(this.store.getUserByEmail(email));
```

**Prevention:**
- Create a common `IStore` interface that all stores implement
- Make the interface explicitly async (all methods return Promises)
- TypeScript will then enforce `await` at call sites

---

### Issue 2: IPv6 vs IPv4 Database Connection

**Severity:** Critical  
**Status:** ✅ Fixed

**Problem:**
Supabase's "Direct Connection" only supports IPv6, but Render's free tier only supports IPv4 outbound connections.

**Symptom:**
```
Error: connect ENETUNREACH 2600:1f18:2e13:9d25:...
```

**Solution:**
1. Use Supabase's **Session Pooler** connection (IPv4 compatible)
2. Added manual DNS resolution forcing IPv4 in `db/client.ts` and `db/migrate.ts`:
```typescript
const result = await dnsLookup(hostname, { family: 4 });
```

**Prevention:**
- Document the correct Supabase connection type in DEPLOYMENT.md
- Add validation on startup to check connection string format

---

### Issue 3: Rate Limiter IPv6 Key Generation

**Severity:** Medium  
**Status:** ✅ Fixed

**Problem:**
Custom `keyGenerator` in rate limiter used `req.ip` without IPv6 handling.

**Symptom:**
```
ValidationError: Custom keyGenerator appears to use request IP without calling ipKeyGenerator
```

**Solution:**
Removed custom keyGenerator, use default which handles IPv6:
```typescript
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { xForwardedForHeader: false },
  // Use default keyGenerator
});
```

---

## Deployment Issues

### Issue 4: CORS Configuration

**Severity:** Medium  
**Status:** ✅ Fixed

**Problem:**
Frontend URL not in `ALLOWED_ORIGINS` caused CORS errors.

**Symptom:**
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading...
```

**Solution:**
Add frontend URL with `https://` to `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://my-books-tau.vercel.app,http://localhost:5173
```

**Prevention:**
- Include CORS check in deployment checklist
- Add validation on startup that warns if ALLOWED_ORIGINS is empty in production

---

### Issue 5: Wrong Supabase Connection String Format

**Severity:** Critical  
**Status:** ✅ Documented

**Problem:**
User copied "Direct Connection" string instead of "Session Pooler" string.

**Wrong format:** `postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres`  
**Correct format:** `postgresql://postgres.xxx:xxx@aws-0-xxx.pooler.supabase.com:5432/postgres`

**Prevention:**
- Clear documentation with examples
- Add validation on startup to check hostname format

---

## Architecture Decisions

### Decision 1: Database Abstraction Layer

**Current State:** Two separate store implementations (DbStore, PgStore) with no common interface.

**Problem:** No way to enforce that both stores have the same method signatures.

**Recommendation:**
Create `IStore` interface that both must implement:
```typescript
interface IStore {
  // All methods return Promises for consistency
  getUserByEmail(email: string): Promise<User | undefined>;
  listJournals(orgId: string): Promise<Journal[]>;
  // ... etc
}
```

### Decision 2: Service Layer Async Pattern

**Current State:** Services assume synchronous store methods.

**Problem:** PgStore is inherently async due to database I/O.

**Recommendation:**
1. All service methods should be `async`
2. All store method calls should use `await`
3. All route handlers should be `async` and `await` service methods

---

## Technical Debt

### TD-1: Frontend Type Safety
- Several `any` types in API responses
- Missing proper error types

### TD-2: Missing Tests
- No unit tests for services
- No integration tests for API routes
- No E2E tests for critical flows

### TD-3: Error Handling Inconsistency
- Some routes return `{ error: message }`, others throw
- No standardized error response format

### TD-4: Hardcoded Org ID
- `demo-org` hardcoded in many frontend components
- Should use authenticated user's org

### TD-5: Missing Pagination
- Many list endpoints return all records
- Will cause performance issues at scale

---

## User Testing Feedback (Dec 2024)

### Feedback 1: Invoice OCR Not Working

**Status:** ✅ Fixed

**Problem:** Users could upload images but nothing happened after upload.

**Root Causes:**
1. PDF files were not supported (only images)
2. `OPENAI_API_KEY` may not be configured in Render
3. Error messages weren't being displayed clearly

**Solution:**
- Added PDF support using `pdf-parse` library
- Backend extracts text from PDFs and sends to OpenAI
- Frontend now accepts PDF files
- Better error handling and status messages

---

### Feedback 2: Expense Review/Edit Missing

**Status:** ✅ Fixed

**Problem:** No visible way to review or approve/reject expenses after they're submitted.

**Solution:**
- Added prominent review panel showing all pending expenses
- Each expense shows full details (vendor, amount, date, description)
- Clear Approve ✓ and Reject ✗ buttons
- Summary bar highlights pending count with warning indicator

---

### Feedback 3: Journal Entry Details Not Shown

**Status:** ✅ Fixed

**Problem:** Journal entries show "Review" button but no details about what you're reviewing.

**Solution:**
- Added expandable rows (click to expand)
- Shows all line items with account names, debits, credits
- Displays totals and validates debits = credits
- Shows external reference (blockchain TX hash) and creation date

---

## Recommendations

### Immediate ✅ DONE

1. ~~Complete async refactor for all services~~ ✅
2. ~~Create IStore interface for type safety~~ ✅
3. Add startup validation for environment variables
4. Add health check that verifies database connectivity

### Short-term (Next Sprint)

1. Add unit tests for critical services (Auth, Ledger)
2. Standardize error response format
3. Fix hardcoded org IDs in frontend
4. Add proper TypeScript types for API responses

### Medium-term (Next Month)

1. Add integration tests
2. Implement proper pagination for all list endpoints
3. Add request validation middleware (Zod schemas for all endpoints)
4. Implement proper logging with correlation IDs

---

*Last updated: December 2024*


