import { DbStore } from "../store.db";
import { FXRate } from "../types";
import { newId } from "../../utils/id";
import axios from "axios";

interface FXExposure {
  currency: string;
  balance: number;
  rateToBase: number;
  valueInBase: number;
}

interface FXGainLoss {
  currency: string;
  originalAmount: number;
  originalRate: number;
  currentRate: number;
  originalValue: number;
  currentValue: number;
  unrealizedGainLoss: number;
}

export class FXService {
  private baseCurrency: string;

  constructor(private store: DbStore, baseCurrency = "USD") {
    this.baseCurrency = baseCurrency;
  }

  // ============ FX RATES ============
  async fetchRate(base: string, quote: string): Promise<number> {
    try {
      // Use a free FX API
      const url = `https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`;
      const res = await axios.get(url, { timeout: 5000 });
      const rate = res.data?.rates?.[quote];
      if (rate) {
        this.recordRate(base, quote, rate, "exchangerate.host");
        return rate;
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: check stored rates
    const stored = this.getLatestRate(base, quote);
    return stored?.rate || 1;
  }

  recordRate(base: string, quote: string, rate: number, source: string): FXRate {
    const fxRate: FXRate = {
      id: newId(),
      base,
      quote,
      rate,
      timestamp: new Date().toISOString(),
      source
    };
    this.store.addFxRate(fxRate);
    return fxRate;
  }

  getLatestRate(base: string, quote: string): FXRate | undefined {
    // Query from DB - simplified, would need proper query
    const rates = this.store.db
      .prepare("SELECT * FROM fx_rates WHERE base = ? AND quote = ? ORDER BY timestamp DESC LIMIT 1")
      .get(base, quote) as FXRate | undefined;
    return rates;
  }

  // ============ CONVERSIONS ============
  convert(amount: number, fromCurrency: string, toCurrency: string, rate?: number): number {
    if (fromCurrency === toCurrency) return amount;

    const fxRate = rate || this.getLatestRate(fromCurrency, toCurrency)?.rate || 1;
    return amount * fxRate;
  }

  // ============ FX EXPOSURE ============
  calculateExposure(orgId: string, balancesByCurrency: Record<string, number>): FXExposure[] {
    const exposures: FXExposure[] = [];

    for (const [currency, balance] of Object.entries(balancesByCurrency)) {
      const rate = currency === this.baseCurrency ? 1 : (this.getLatestRate(currency, this.baseCurrency)?.rate || 1);

      exposures.push({
        currency,
        balance,
        rateToBase: rate,
        valueInBase: balance * rate
      });
    }

    return exposures;
  }

  // ============ UNREALIZED GAINS/LOSSES ============
  calculateUnrealizedGainLoss(
    currency: string,
    originalAmount: number,
    originalRate: number,
    currentRate?: number
  ): FXGainLoss {
    const rate = currentRate || this.getLatestRate(currency, this.baseCurrency)?.rate || originalRate;

    const originalValue = originalAmount * originalRate;
    const currentValue = originalAmount * rate;
    const unrealizedGainLoss = currentValue - originalValue;

    return {
      currency,
      originalAmount,
      originalRate,
      currentRate: rate,
      originalValue,
      currentValue,
      unrealizedGainLoss
    };
  }

  // ============ REALIZED GAINS/LOSSES ============
  calculateRealizedGainLoss(
    originalAmount: number,
    originalRate: number,
    settlementRate: number
  ): number {
    const originalValue = originalAmount * originalRate;
    const settlementValue = originalAmount * settlementRate;
    return settlementValue - originalValue;
  }

  // ============ REPORTS ============
  exposureReport(orgId: string) {
    const accounts = this.store.listAccounts(orgId);
    const journals = this.store.listJournals(orgId).filter((j) => j.status === "posted");

    // Calculate balances by currency
    const balancesByCurrency: Record<string, number> = {};

    for (const journal of journals) {
      for (const line of journal.lines) {
        const currency = line.currency || "USD";
        if (!balancesByCurrency[currency]) {
          balancesByCurrency[currency] = 0;
        }
        balancesByCurrency[currency] += line.debit - line.credit;
      }
    }

    const exposures = this.calculateExposure(orgId, balancesByCurrency);
    const totalExposure = exposures.reduce((s, e) => s + e.valueInBase, 0);
    const foreignExposure = exposures
      .filter((e) => e.currency !== this.baseCurrency)
      .reduce((s, e) => s + e.valueInBase, 0);

    return {
      baseCurrency: this.baseCurrency,
      exposures,
      totals: {
        totalExposure,
        foreignExposure,
        domesticExposure: totalExposure - foreignExposure,
        foreignPercentage: totalExposure > 0 ? (foreignExposure / totalExposure) * 100 : 0
      }
    };
  }

  gainLossSummary(orgId: string, transactions: { currency: string; amount: number; originalRate: number }[]) {
    const summary: FXGainLoss[] = [];

    for (const txn of transactions) {
      if (txn.currency === this.baseCurrency) continue;

      const gainLoss = this.calculateUnrealizedGainLoss(txn.currency, txn.amount, txn.originalRate);
      summary.push(gainLoss);
    }

    const totalUnrealized = summary.reduce((s, g) => s + g.unrealizedGainLoss, 0);

    return {
      details: summary,
      totalUnrealizedGainLoss: totalUnrealized
    };
  }
}



