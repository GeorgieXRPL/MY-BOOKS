import { LedgerService } from "../ledger";
import { IStore } from "../store.interface";
import { Account, JournalEntry, JournalLine, NormalizedTxn } from "../types";
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
  constructor(private store: IStore, private ledger: LedgerService) {}

  private async findAccount(orgId: string, nameIncludes: string): Promise<Account | undefined> {
    const accounts = await Promise.resolve(this.store.listAccounts(orgId));
    return accounts.find((a: Account) => a.name.toLowerCase().includes(nameIncludes.toLowerCase()));
  }

  private async alreadyIngested(id: string): Promise<boolean> {
    const journals = await Promise.resolve(this.store.listJournals("demo-org"));
    return journals.some((j: JournalEntry) => j.externalRef === id);
  }

  async ingest(txns: BankTxn[], actorId: string, period: string): Promise<NormalizedTxn[]> {
    const results: NormalizedTxn[] = [];
    for (const t of txns) {
      if (await this.alreadyIngested(t.externalId)) continue;
      const cash = await this.findAccount(t.orgId, "Bank Accounts") ?? await this.findAccount(t.orgId, "Cash");
      const revenue = await this.findAccount(t.orgId, "Revenue");
      const expense = await this.findAccount(t.orgId, "Operating Expenses");
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

      await this.ledger.createDraft({
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

