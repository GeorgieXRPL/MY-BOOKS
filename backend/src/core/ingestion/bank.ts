import { LedgerService } from "../ledger";
import { JournalLine, NormalizedTxn } from "../types";
import { newId } from "../../utils/id";

export interface BankTxn {
  orgId: string;
  externalId: string;
  amount: number;
  currency: string;
  description: string;
  timestamp: string;
}

export class BankIngestor {
  constructor(private store: any, private ledger: LedgerService) {}

  private findAccount(orgId: string, nameIncludes: string) {
    return this.store
      .listAccounts(orgId)
      .find((a) => a.name.toLowerCase().includes(nameIncludes.toLowerCase()));
  }

  private alreadyIngested(id: string) {
    return this.store.listJournals("demo-org").some((j: any) => j.externalRef === id);
  }

  ingest(txns: BankTxn[], actorId: string, period: string) {
    const results: NormalizedTxn[] = [];
    for (const t of txns) {
      if (this.alreadyIngested(t.externalId)) continue;
      const cash = this.findAccount(t.orgId, "Bank Accounts") ?? this.findAccount(t.orgId, "Cash");
      const revenue = this.findAccount(t.orgId, "Revenue");
      const expense = this.findAccount(t.orgId, "Operating Expenses");
      if (!cash || !revenue || !expense) throw new Error("Required accounts missing");

      const lines: JournalLine[] = [];
      if (t.amount >= 0) {
        lines.push({
          id: newId(),
          accountId: cash.id,
          debit: t.amount,
          credit: 0,
          currency: t.currency,
          description: t.description,
          externalRef: t.externalId
        });
        lines.push({
          id: newId(),
          accountId: revenue.id,
          debit: 0,
          credit: t.amount,
          currency: t.currency,
          description: "Bank inflow",
          externalRef: t.externalId
        });
      } else {
        const amt = Math.abs(t.amount);
        lines.push({
          id: newId(),
          accountId: expense.id,
          debit: amt,
          credit: 0,
          currency: t.currency,
          description: t.description,
          externalRef: t.externalId
        });
        lines.push({
          id: newId(),
          accountId: cash.id,
          debit: 0,
          credit: amt,
          currency: t.currency,
          description: "Bank outflow",
          externalRef: t.externalId
        });
      }

      this.ledger.createDraft({
        orgId: t.orgId,
        period,
        lines,
        memo: `Bank txn ${t.externalId}`,
        createdBy: actorId,
        externalRef: t.externalId
      });

      results.push({
        id: t.externalId,
        orgId: t.orgId,
        amount: t.amount,
        currency: t.currency,
        direction: t.amount >= 0 ? "inflow" : "outflow",
        description: t.description,
        occurredAt: t.timestamp,
        externalRef: t.externalId,
        usdValue: t.amount
      });
    }
    return results;
  }
}

