import { NormalizedTxn, TreasuryPolicy } from "./types";
import { IStore } from "./store.interface";

export class ControlsService {
  constructor(private store: IStore) {}

  async setPolicy(orgId: string, policy: TreasuryPolicy): Promise<TreasuryPolicy> {
    await Promise.resolve(this.store.setPolicy(orgId, policy));
    return policy;
  }

  async evaluate(orgId: string, tx: NormalizedTxn): Promise<{ ok: boolean; issues: string[] }> {
    const policy = await Promise.resolve(this.store.getPolicy(orgId));
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

