import { LedgerService } from "../ledger";
import { PricingService } from "./pricing";
import { IStore } from "../store.interface";
import { Account, JournalEntry, JournalLine, NormalizedTxn } from "../types";
import { newId } from "../../utils/id";

export interface WalletTransfer {
  orgId: string;
  walletId: string;
  hash: string;
  from: string;
  to: string;
  value: number;
  tokenSymbol: string;
  timestamp: string;
  gasFee?: number;
}

export class WalletIngestor {
  constructor(
    private store: IStore,
    private pricing: PricingService,
    private ledger: LedgerService
  ) {}

  private async findAccount(orgId: string, nameIncludes: string): Promise<Account | undefined> {
    const accounts = await Promise.resolve(this.store.listAccounts(orgId));
    return accounts.find((a: Account) => a.name.toLowerCase().includes(nameIncludes.toLowerCase()));
  }

  private async alreadyIngested(hash: string): Promise<boolean> {
    const journals = await Promise.resolve(this.store.listJournals("demo-org"));
    return journals.some((j: JournalEntry) => j.externalRef === hash);
  }

  async ingest(transfers: WalletTransfer[], actorId: string, period: string): Promise<NormalizedTxn[]> {
    const results: NormalizedTxn[] = [];
    for (const t of transfers) {
      if (await this.alreadyIngested(t.hash)) continue;
      const amountAbs = Math.abs(t.value);
      const usdValue = await this.pricing.value(t.tokenSymbol, amountAbs, "USD");
      const direction = t.value >= 0 ? "inflow" : "outflow";
      const asset = await this.findAccount(t.orgId, "Crypto Assets - Treasury") ??
        await this.findAccount(t.orgId, "Crypto Assets");
      const revenue = await this.findAccount(t.orgId, "Revenue");
      const expense = await this.findAccount(t.orgId, "Operating Expenses");
      if (!asset || !revenue || !expense) {
        throw new Error("Required accounts not found in COA");
      }

      const lines: JournalLine[] = [];
      if (direction === "inflow") {
        lines.push({
          id: newId(),
          accountId: asset.id,
          debit: usdValue,
          credit: 0,
          currency: "USD",
          description: `Wallet inflow ${t.tokenSymbol}`,
          walletId: t.walletId,
          tokenSymbol: t.tokenSymbol,
          txHash: t.hash,
          externalRef: t.hash
        });
        lines.push({
          id: newId(),
          accountId: revenue.id,
          debit: 0,
          credit: usdValue,
          currency: "USD",
          description: "Recognize inflow",
          walletId: t.walletId,
          tokenSymbol: t.tokenSymbol,
          txHash: t.hash,
          externalRef: t.hash
        });
      } else {
        lines.push({
          id: newId(),
          accountId: expense.id,
          debit: usdValue,
          credit: 0,
          currency: "USD",
          description: `Wallet outflow ${t.tokenSymbol}`,
          walletId: t.walletId,
          tokenSymbol: t.tokenSymbol,
          txHash: t.hash,
          externalRef: t.hash
        });
        lines.push({
          id: newId(),
          accountId: asset.id,
          debit: 0,
          credit: usdValue,
          currency: "USD",
          description: "Reduce asset",
          walletId: t.walletId,
          tokenSymbol: t.tokenSymbol,
          txHash: t.hash,
          externalRef: t.hash
        });
      }

      if (t.gasFee && t.gasFee > 0) {
        const gas = await this.findAccount(t.orgId, "Gas/Network Fees") ?? expense;
        lines.push({
          id: newId(),
          accountId: gas.id,
          debit: t.gasFee,
          credit: 0,
          currency: "USD",
          description: "Gas fee",
          walletId: t.walletId,
          txHash: t.hash,
          externalRef: t.hash
        });
        lines.push({
          id: newId(),
          accountId: asset.id,
          debit: 0,
          credit: t.gasFee,
          currency: "USD",
          description: "Pay gas",
          walletId: t.walletId,
          txHash: t.hash,
          externalRef: t.hash
        });
      }

      await this.ledger.createDraft({
        orgId: t.orgId,
        period,
        lines,
        memo: `Wallet tx ${t.hash}`,
        createdBy: actorId,
        externalRef: t.hash
      });

      results.push({
        id: t.hash,
        orgId: t.orgId,
        amount: amountAbs,
        currency: t.tokenSymbol,
        direction: direction as "inflow" | "outflow",
        description: "Wallet transfer",
        occurredAt: t.timestamp,
        walletId: t.walletId,
        externalRef: t.hash,
        tokenSymbol: t.tokenSymbol,
        usdValue
      });
    }
    return results;
  }
}

