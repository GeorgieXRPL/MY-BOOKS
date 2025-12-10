import { NormalizedTxn, TreasuryPolicy } from "./types";

export class ControlsService {
  constructor(private store: any) {}

  setPolicy(orgId: string, policy: TreasuryPolicy) {
    this.store.setPolicy(orgId, policy);
    return policy;
  }

  evaluate(orgId: string, tx: NormalizedTxn) {
    const policy = this.store.getPolicy(orgId);
    if (!policy) return { ok: true, issues: [] as string[] };

    const issues: string[] = [];
    if (tx.amount > policy.maxSingleSpend) {
      issues.push("Single spend exceeds policy threshold");
    }
    if (Math.abs(tx.amount) > policy.largeTxAlertThreshold) {
      issues.push("Large transaction alert");
    }
    // Multisig/quorum checks would integrate with wallet providers; placeholder
    const ok = issues.length === 0;
    return { ok, issues };
  }
}

