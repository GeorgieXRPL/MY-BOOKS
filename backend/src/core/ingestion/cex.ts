import { LedgerService } from "../ledger";
import { PricingService } from "./pricing";
import { IStore } from "../store.interface";
import { Account, JournalEntry, JournalLine, NormalizedTxn } from "../types";
import { newId } from "../../utils/id";

export interface CexTrade {
  orgId: string;
  tradeId: string;
  baseSymbol: string;
  quoteSymbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  timestamp: string;
}

export class CexIngestor {
  constructor(
    private store: IStore,
    private pricing: PricingService,
    private ledger: LedgerService
  ) {}

  private async findAccount(orgId: string, nameIncludes: string): Promise<Account | undefined> {
    const accounts = await Promise.resolve(this.store.listAccounts(orgId));
    return accounts.find((a: Account) => a.name.toLowerCase().includes(nameIncludes.toLowerCase()));
  }

  private async alreadyIngested(id: string): Promise<boolean> {
    const journals = await Promise.resolve(this.store.listJournals("demo-org"));
    return journals.some((j: JournalEntry) => j.externalRef === id);
  }

  async ingest(trades: CexTrade[], actorId: string, period: string): Promise<NormalizedTxn[]> {
    const results: NormalizedTxn[] = [];
    for (const t of trades) {
      if (await this.alreadyIngested(t.tradeId)) continue;
      const asset = await this.findAccount(t.orgId, "CEX Balances") ?? await this.findAccount(t.orgId, "Crypto Assets");
      const cash = await this.findAccount(t.orgId, "Bank Accounts") ?? await this.findAccount(t.orgId, "Cash");
      const expense = await this.findAccount(t.orgId, "Operating Expenses");
      if (!asset || !cash || !expense) throw new Error("Required accounts not found");

      const notional = t.quantity * t.price;
      const lines: JournalLine[] = [];

      if (t.side === "buy") {
        lines.push({
          id: newId(),
          accountId: asset.id,
          debit: notional,
          credit: 0,
          currency: t.quoteSymbol,
          description: `Buy ${t.baseSymbol}`,
          externalRef: t.tradeId
        });
        lines.push({
          id: newId(),
          accountId: cash.id,
          debit: 0,
          credit: notional,
          currency: t.quoteSymbol,
          description: "Pay for purchase",
          externalRef: t.tradeId
        });
      } else {
        lines.push({
          id: newId(),
          accountId: cash.id,
          debit: notional,
          credit: 0,
          currency: t.quoteSymbol,
          description: `Sell ${t.baseSymbol}`,
          externalRef: t.tradeId
        });
        lines.push({
          id: newId(),
          accountId: asset.id,
          debit: 0,
          credit: notional,
          currency: t.quoteSymbol,
          description: "Reduce asset",
          externalRef: t.tradeId
        });
      }

      if (t.fee > 0) {
        lines.push({
          id: newId(),
          accountId: expense.id,
          debit: t.fee,
          credit: 0,
          currency: t.quoteSymbol,
          description: "Trading fee",
          externalRef: t.tradeId
        });
        lines.push({
          id: newId(),
          accountId: cash.id,
          debit: 0,
          credit: t.fee,
          currency: t.quoteSymbol,
          description: "Pay fee",
          externalRef: t.tradeId
        });
      }

      await this.ledger.createDraft({
        orgId: t.orgId,
        period,
        lines,
        memo: `CEX trade ${t.tradeId}`,
        createdBy: actorId,
        externalRef: t.tradeId
      });

      const usdValue = await this.pricing.value(t.baseSymbol, t.quantity, "USD");
      results.push({
        id: t.tradeId,
        orgId: t.orgId,
        amount: t.quantity,
        currency: t.baseSymbol,
        direction: t.side === "buy" ? "inflow" : "outflow",
        description: "CEX trade",
        occurredAt: t.timestamp,
        externalRef: t.tradeId,
        tokenSymbol: t.baseSymbol,
        usdValue
      });
    }
    return results;
  }
}

