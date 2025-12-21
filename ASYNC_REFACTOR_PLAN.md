# Async Refactor Plan

This document outlines the plan to convert all backend services to properly support async/await patterns for PostgreSQL compatibility.

---

## Overview

**Goal:** Make all services work correctly with both SQLite (sync) and PostgreSQL (async) stores.

**Approach:** Wrap all store method calls with `await Promise.resolve()` which works for both sync and async methods.

**Estimated Effort:** 2-3 hours for complete refactor

---

## Phase 1: Create Store Interface (30 min)

### 1.1 Create IStore Interface

Create `backend/src/core/store.interface.ts`:

```typescript
export interface IStore {
  // User management
  getUserById(id: string): any | Promise<any>;
  getUserByEmail(email: string): any | Promise<any>;
  createUser(user: any): any | Promise<any>;
  updateUser(id: string, updates: any): any | Promise<any>;
  listUsersByOrg(orgId: string): any | Promise<any>;
  
  // Journals
  listJournals(orgId: string): any | Promise<any>;
  getJournal(id: string): any | Promise<any>;
  createJournal(journal: any): any | Promise<any>;
  updateJournal(id: string, updates: any): any | Promise<any>;
  
  // Accounts
  listAccounts(orgId: string): any | Promise<any>;
  getAccount(id: string): any | Promise<any>;
  upsertAccount(account: any): any | Promise<any>;
  
  // ... all other methods
}
```

### 1.2 Have Both Stores Implement Interface

Update DbStore and PgStore to implement IStore.

---

## Phase 2: Refactor Core Services (60 min)

### Order of Refactoring

Refactor in dependency order (least dependencies first):

| Order | Service | Dependencies | Priority |
|-------|---------|--------------|----------|
| 1 | AuditLogService | Store only | High |
| 2 | RbacService | Store only | High |
| 3 | ControlsService | Store only | Medium |
| 4 | CloseService | Store only | Medium |
| 5 | LedgerService | Store, Audit | **Critical** |
| 6 | PricingService | Store only | Medium |
| 7 | ReportingService | Store, Ledger | **Critical** |
| 8 | ReconciliationService | Store | Medium |
| 9 | InvoiceService | Store, Audit | High |
| 10 | ExpenseService | Store, Audit | Medium |
| 11 | PayrollService | Store, Audit, Ledger | Medium |
| 12 | BankTxnService | Store, Audit | Medium |
| 13 | CryptoService | Store, Audit | Medium |
| 14 | RatioService | Store, Reporting | Medium |
| 15 | FormulaService | Store, Reporting | Low |
| 16 | DepreciationService | Store, Ledger | Low |
| 17 | FXService | Store | Low |
| 18 | TaxService | Store | Low |

### Refactoring Pattern

For each service:

1. Make all public methods `async`
2. Wrap store calls with `await Promise.resolve()`
3. Update return types to `Promise<T>`

**Before:**
```typescript
list(orgId: string): Invoice[] {
  const invoices = this.store.listInvoices(orgId);
  return invoices.filter(i => i.status !== 'deleted');
}
```

**After:**
```typescript
async list(orgId: string): Promise<Invoice[]> {
  const invoices = await Promise.resolve(this.store.listInvoices(orgId));
  return invoices.filter(i => i.status !== 'deleted');
}
```

---

## Phase 3: Refactor Routes (45 min)

### Routes to Update

| Route File | Estimated Changes |
|------------|------------------|
| `ledger.ts` | 10-15 handlers |
| `invoices.ts` | 8-10 handlers |
| `expenses.ts` | 6-8 handlers |
| `payroll.ts` | 6-8 handlers |
| `bankTxns.ts` | 6-8 handlers |
| `crypto.ts` | 8-10 handlers |
| `assets.ts` | 6-8 handlers |
| `calculations.ts` | 10-12 handlers |
| `reporting.ts` | 6-8 handlers |
| `close.ts` | 4-6 handlers |
| `ingestion.ts` | 4-6 handlers |
| `security.ts` | Already updated |

### Route Refactoring Pattern

**Before:**
```typescript
router.get("/", (req, res) => {
  const items = service.list(orgId);
  res.json(items);
});
```

**After:**
```typescript
router.get("/", async (req, res) => {
  try {
    const items = await service.list(orgId);
    res.json(items);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
```

---

## Phase 4: Testing & Validation (30 min)

### 4.1 Build Verification
```bash
cd backend && npm run build
```

### 4.2 Local Testing with SQLite
```bash
# No DATABASE_URL = SQLite
npm run dev
```

### 4.3 Local Testing with PostgreSQL
```bash
# Set DATABASE_URL to Supabase
DATABASE_URL="postgresql://..." npm run dev
```

### 4.4 Endpoint Testing
Test each major endpoint:
- [ ] Auth: Register, Login, Refresh
- [ ] Ledger: List accounts, Create journal
- [ ] Invoices: List, Create, Update
- [ ] Reports: Balance sheet, Income statement

---

## Phase 5: Deployment (15 min)

1. Commit changes with clear message
2. Push to main
3. Wait for Render to redeploy
4. Verify health endpoint
5. Test frontend functionality

---

## Risk Mitigation

### Risk 1: Breaking Changes
**Mitigation:** Test with both SQLite and PostgreSQL locally before pushing

### Risk 2: Missing Await
**Mitigation:** TypeScript will warn about unhandled Promises

### Risk 3: Performance Regression
**Mitigation:** Promise.resolve() has negligible overhead for sync values

---

## Success Criteria

- [ ] All services compile without errors
- [ ] All routes compile without errors
- [ ] SQLite mode works (no DATABASE_URL)
- [ ] PostgreSQL mode works (with DATABASE_URL)
- [ ] All frontend pages load without errors
- [ ] Register/Login flow works
- [ ] CRUD operations work for all entities

---

## Rollback Plan

If issues occur after deployment:

1. Revert to previous commit: `git revert HEAD`
2. Push revert: `git push origin main`
3. Remove DATABASE_URL from Render to use SQLite
4. Debug locally with PostgreSQL

---

*Created: December 2024*
