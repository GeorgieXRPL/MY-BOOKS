import { ReconciliationItem } from "./types";
import { IStore } from "./store.interface";

interface ReconInput {
  orgId: string;
  source: "wallet" | "bank" | "cex";
  externalRef: string;
  externalBalance: number;
  ledgerBalance: number;
  note?: string;
}

export class ReconciliationService {
  constructor(private store: IStore) {}

  async reconcile(input: ReconInput): Promise<ReconciliationItem> {
    const delta = input.externalBalance - input.ledgerBalance;
    const status = Math.abs(delta) < 0.0001 ? "matched" : "unmatched";
    await Promise.resolve(this.store.addReconciliation({ ...input, delta, status }));
    // Return the item (addReconciliation doesn't return the created item, so we reconstruct)
    const items = await Promise.resolve(this.store.listReconciliations(input.orgId));
    return items[items.length - 1];
  }

  async list(orgId: string): Promise<ReconciliationItem[]> {
    return Promise.resolve(this.store.listReconciliations(orgId));
  }
}

