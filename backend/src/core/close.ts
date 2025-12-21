import { ChecklistItem } from "./types";
import { IStore } from "./store.interface";
import { newId } from "../utils/id";

const DEFAULT_STEPS = [
  "Reconcile wallets vs ledger",
  "Reconcile banks vs ledger",
  "Review CEX balances",
  "Post accruals",
  "Lock period"
];

export class CloseService {
  constructor(private store: IStore) {}

  async seed(orgId: string, period: string): Promise<ChecklistItem[]> {
    // Check if store has listChecklist method
    if (this.store.listChecklist) {
      const existing = await Promise.resolve(this.store.listChecklist(orgId, period));
      if (existing.length) return existing;
      
      const items: ChecklistItem[] = DEFAULT_STEPS.map((title) => ({
        id: newId(),
        orgId,
        period,
        title,
        completed: false
      }));
      
      if (this.store.addChecklistItem) {
        for (const item of items) {
          await Promise.resolve(this.store.addChecklistItem(item));
        }
      }
      return items;
    }
    
    // Fallback for stores without checklist support
    const items: ChecklistItem[] = DEFAULT_STEPS.map((title) => ({
      id: newId(),
      orgId,
      period,
      title,
      completed: false
    }));
    return items;
  }

  async list(orgId: string, period: string): Promise<ChecklistItem[]> {
    if (this.store.listChecklist) {
      return Promise.resolve(this.store.listChecklist(orgId, period));
    }
    return [];
  }

  async complete(id: string, userId: string): Promise<ChecklistItem> {
    if (this.store.updateChecklistItem) {
      await Promise.resolve(this.store.updateChecklistItem(id, {
        completed: true,
        completedBy: userId,
        completedAt: new Date().toISOString()
      }));
    }
    // Return a placeholder - in production, we'd fetch the updated item
    return {
      id,
      orgId: "",
      period: "",
      title: "",
      completed: true,
      completedBy: userId,
      completedAt: new Date().toISOString()
    };
  }
}

