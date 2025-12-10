import { ChecklistItem } from "./types";
import { newId } from "../utils/id";

const DEFAULT_STEPS = [
  "Reconcile wallets vs ledger",
  "Reconcile banks vs ledger",
  "Review CEX balances",
  "Post accruals",
  "Lock period"
];

export class CloseService {
  constructor(private store: any) {}

  seed(orgId: string, period: string) {
    const existing = this.store.checklist.filter((c) => c.orgId === orgId && c.period === period);
    if (existing.length) return existing;
    const items: ChecklistItem[] = DEFAULT_STEPS.map((title) => ({
      id: newId(),
      orgId,
      period,
      title,
      completed: false
    }));
    this.store.checklist.push(...items);
    return items;
  }

  list(orgId: string, period: string) {
    return this.store.checklist.filter((c) => c.orgId === orgId && c.period === period);
  }

  complete(id: string, userId: string) {
    const item = this.store.checklist.find((c) => c.id === id);
    if (!item) throw new Error("Checklist item not found");
    item.completed = true;
    item.completedBy = userId;
    item.completedAt = new Date().toISOString();
    return item;
  }
}

