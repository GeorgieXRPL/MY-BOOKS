import { IStore } from "./store.interface";
import { CryptoTransaction, CryptoLot, CryptoTxnType } from "./types";
import { newId } from "../utils/id";
import { AuditLogService } from "./security/auditLog";

interface CreateCryptoTxnInput {
  orgId: string;
  walletId: string;
  txHash: string;
  type: CryptoTxnType;
  tokenSymbol: string;
  quantity: number;
  priceUsd: number;
  feeUsd: number;
  timestamp: string;
  fromAddress?: string;
  toAddress?: string;
  swapToToken?: string;
  swapToQty?: string;
}

type CostBasisMethod = "fifo" | "lifo" | "average";

export class CryptoService {
  constructor(private store: IStore, private audit: AuditLogService) {}

  async recordTransaction(input: CreateCryptoTxnInput): Promise<CryptoTransaction> {
    const txn: CryptoTransaction = {
      id: newId(),
      orgId: input.orgId,
      walletId: input.walletId,
      txHash: input.txHash,
      type: input.type,
      tokenSymbol: input.tokenSymbol,
      quantity: input.quantity,
      priceUsd: input.priceUsd,
      valueUsd: input.quantity * input.priceUsd,
      feeUsd: input.feeUsd,
      timestamp: input.timestamp,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      swapToToken: input.swapToToken,
      swapToQty: input.swapToQty,
      createdAt: new Date().toISOString()
    };

    await Promise.resolve(this.store.addCryptoTransaction(txn));

    // Create lot for acquisitions
    if (["transfer", "reward", "stake"].includes(input.type) && input.quantity > 0) {
      const lot: CryptoLot = {
        id: newId(),
        orgId: input.orgId,
        tokenSymbol: input.tokenSymbol,
        quantity: input.quantity,
        costBasisUsd: input.quantity * input.priceUsd + input.feeUsd,
        acquiredAt: input.timestamp,
        txnId: txn.id,
        remainingQty: input.quantity
      };
      await Promise.resolve(this.store.addCryptoLot(lot));
    }

    await this.audit.log({
      orgId: input.orgId,
      actorId: "system",
      action: "record",
      entity: "crypto_transaction",
      entityId: txn.id
    });

    return txn;
  }

  async listTransactions(orgId: string, tokenSymbol?: string): Promise<CryptoTransaction[]> {
    let txns = await Promise.resolve(this.store.listCryptoTransactions(orgId));
    if (tokenSymbol) {
      txns = txns.filter((t) => t.tokenSymbol === tokenSymbol);
    }
    return txns;
  }

  async listLots(orgId: string, tokenSymbol?: string): Promise<CryptoLot[]> {
    return Promise.resolve(this.store.listCryptoLots(orgId, tokenSymbol));
  }

  async calculateRealizedGain(
    orgId: string,
    tokenSymbol: string,
    disposalQty: number,
    disposalPriceUsd: number,
    method: CostBasisMethod = "fifo"
  ) {
    const allLots = await Promise.resolve(this.store.listCryptoLots(orgId, tokenSymbol));
    const lots = allLots.filter((l) => l.remainingQty > 0);

    if (method === "lifo") {
      lots.reverse();
    }

    let remaining = disposalQty;
    let totalCostBasis = 0;
    const usedLots: { lotId: string; qty: number; costBasis: number }[] = [];

    if (method === "average") {
      const totalQty = lots.reduce((s, l) => s + l.remainingQty, 0);
      const totalCost = lots.reduce((s, l) => s + (l.costBasisUsd / l.quantity) * l.remainingQty, 0);
      const avgCost = totalQty > 0 ? totalCost / totalQty : 0;

      totalCostBasis = avgCost * disposalQty;

      // Reduce lots proportionally
      for (const lot of lots) {
        if (remaining <= 0) break;
        const useQty = Math.min(lot.remainingQty, remaining);
        usedLots.push({ lotId: lot.id, qty: useQty, costBasis: avgCost * useQty });
        await Promise.resolve(this.store.updateCryptoLot(lot.id, { remainingQty: lot.remainingQty - useQty }));
        remaining -= useQty;
      }
    } else {
      // FIFO or LIFO
      for (const lot of lots) {
        if (remaining <= 0) break;

        const useQty = Math.min(lot.remainingQty, remaining);
        const costPerUnit = lot.costBasisUsd / lot.quantity;
        const costBasis = costPerUnit * useQty;

        usedLots.push({ lotId: lot.id, qty: useQty, costBasis });
        totalCostBasis += costBasis;

        await Promise.resolve(this.store.updateCryptoLot(lot.id, { remainingQty: lot.remainingQty - useQty }));
        remaining -= useQty;
      }
    }

    if (remaining > 0) {
      throw new Error(`Insufficient lots: missing ${remaining} ${tokenSymbol}`);
    }

    const proceeds = disposalQty * disposalPriceUsd;
    const realizedGain = proceeds - totalCostBasis;

    return {
      disposalQty,
      proceeds,
      costBasis: totalCostBasis,
      realizedGain,
      method,
      usedLots
    };
  }

  async unrealizedGains(orgId: string, currentPrices: Record<string, number>) {
    const allLots = await Promise.resolve(this.store.listCryptoLots(orgId));
    const lots = allLots.filter((l) => l.remainingQty > 0);

    const byToken: Record<string, { qty: number; costBasis: number; marketValue: number; unrealizedGain: number }> = {};

    for (const lot of lots) {
      if (!byToken[lot.tokenSymbol]) {
        byToken[lot.tokenSymbol] = { qty: 0, costBasis: 0, marketValue: 0, unrealizedGain: 0 };
      }

      const costPerUnit = lot.costBasisUsd / lot.quantity;
      const lotCost = costPerUnit * lot.remainingQty;
      const price = currentPrices[lot.tokenSymbol] || 0;
      const marketValue = lot.remainingQty * price;

      byToken[lot.tokenSymbol].qty += lot.remainingQty;
      byToken[lot.tokenSymbol].costBasis += lotCost;
      byToken[lot.tokenSymbol].marketValue += marketValue;
      byToken[lot.tokenSymbol].unrealizedGain = byToken[lot.tokenSymbol].marketValue - byToken[lot.tokenSymbol].costBasis;
    }

    const totalCostBasis = Object.values(byToken).reduce((s, t) => s + t.costBasis, 0);
    const totalMarketValue = Object.values(byToken).reduce((s, t) => s + t.marketValue, 0);

    return {
      byToken,
      totals: {
        costBasis: totalCostBasis,
        marketValue: totalMarketValue,
        unrealizedGain: totalMarketValue - totalCostBasis
      }
    };
  }

  async costBasisReport(orgId: string) {
    const lots = await Promise.resolve(this.store.listCryptoLots(orgId));
    const txns = await Promise.resolve(this.store.listCryptoTransactions(orgId));

    return {
      lots: lots.map((l) => ({
        ...l,
        costPerUnit: l.costBasisUsd / l.quantity,
        remainingCostBasis: (l.costBasisUsd / l.quantity) * l.remainingQty
      })),
      summary: {
        totalLots: lots.length,
        openLots: lots.filter((l) => l.remainingQty > 0).length,
        totalTransactions: txns.length
      }
    };
  }

  async holdings(orgId: string): Promise<Record<string, number>> {
    const allLots = await Promise.resolve(this.store.listCryptoLots(orgId));
    const lots = allLots.filter((l) => l.remainingQty > 0);

    const byToken: Record<string, number> = {};
    for (const lot of lots) {
      byToken[lot.tokenSymbol] = (byToken[lot.tokenSymbol] || 0) + lot.remainingQty;
    }

    return byToken;
  }
}



