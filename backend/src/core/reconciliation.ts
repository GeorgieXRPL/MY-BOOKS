import { ReconciliationItem } from "./types";

interface ReconInput {
  orgId: string;
  source: "wallet" | "bank" | "cex";
  externalRef: string;
  externalBalance: number;
  ledgerBalance: number;
  note?: string;
}

export class ReconciliationService {
  constructor(private store: any) {}

  reconcile(input: ReconInput): ReconciliationItem {
    const delta = input.externalBalance - input.ledgerBalance;
    const status = Math.abs(delta) < 0.0001 ? "matched" : "unmatched";
    return this.store.addReconciliation({ ...input, delta, status });
  }

  list(orgId: string) {
    return this.store.listReconciliations(orgId);
  }
}

