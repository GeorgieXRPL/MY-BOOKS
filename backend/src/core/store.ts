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
  Wallet
} from "./types";
import { v4 as uuid } from "uuid";

export class InMemoryStore {
  accounts = new Map<string, Account>();
  wallets = new Map<string, Wallet>();
  journals = new Map<string, JournalEntry>();
  prices: PriceTick[] = [];
  fxRates: FXRate[] = [];
  reconciliations: ReconciliationItem[] = [];
  auditLogs: AuditLogEntry[] = [];
  periodLocks: PeriodLock[] = [];
  checklist: ChecklistItem[] = [];
  roles = new Map<string, Role[]>();
  policies = new Map<string, TreasuryPolicy>();

  upsertAccount(account: Account) {
    this.accounts.set(account.id, account);
    return account;
  }

  listAccounts(orgId: string) {
    return Array.from(this.accounts.values()).filter((a) => a.orgId === orgId);
  }

  addWallet(wallet: Wallet) {
    this.wallets.set(wallet.id, wallet);
    return wallet;
  }

  listWallets(orgId: string) {
    return Array.from(this.wallets.values()).filter((w) => w.orgId === orgId);
  }

  addJournal(journal: JournalEntry) {
    this.journals.set(journal.id, journal);
    return journal;
  }

  getJournal(id: string) {
    return this.journals.get(id);
  }

  updateJournal(id: string, patch: Partial<JournalEntry>) {
    const existing = this.journals.get(id);
    if (!existing) throw new Error("Journal not found");
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.journals.set(id, updated);
    return updated;
  }

  listJournals(orgId: string) {
    return Array.from(this.journals.values()).filter((j) => j.orgId === orgId);
  }

  addPriceTick(price: Omit<PriceTick, "id">) {
    const tick: PriceTick = { ...price, id: uuid() };
    this.prices.push(tick);
    return tick;
  }

  latestPrice(symbol: string, currency: string) {
    return this.prices
      .filter((p) => p.symbol === symbol && p.currency === currency)
      .sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))[0];
  }

  addFxRate(rate: Omit<FXRate, "id">) {
    const fx: FXRate = { ...rate, id: uuid() };
    this.fxRates.push(fx);
    return fx;
  }

  addReconciliation(rec: Omit<ReconciliationItem, "id" | "createdAt">) {
    const item: ReconciliationItem = {
      ...rec,
      id: uuid(),
      createdAt: new Date().toISOString()
    };
    this.reconciliations.push(item);
    return item;
  }

  listReconciliations(orgId: string) {
    return this.reconciliations.filter((r) => r.orgId === orgId);
  }

  addAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
    const log: AuditLogEntry = {
      ...entry,
      id: uuid(),
      timestamp: new Date().toISOString()
    };
    this.auditLogs.push(log);
    return log;
  }

  listAudit(orgId: string) {
    return this.auditLogs.filter((a) => a.orgId === orgId);
  }

  lockPeriod(lock: PeriodLock) {
    this.periodLocks.push(lock);
  }

  isPeriodLocked(orgId: string, period: string) {
    return this.periodLocks.some((p) => p.orgId === orgId && p.period === period);
  }

  upsertRole(userId: string, roles: Role[]) {
    this.roles.set(userId, Array.from(new Set(roles)));
  }

  getUserRoles(userId: string) {
    return this.roles.get(userId) ?? [];
  }

  setPolicy(orgId: string, policy: TreasuryPolicy) {
    this.policies.set(orgId, policy);
  }

  getPolicy(orgId: string) {
    return this.policies.get(orgId);
  }
}

