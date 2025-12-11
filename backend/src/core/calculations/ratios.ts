import { DbStore } from "../store.db";
import { ReportingService } from "../reporting";

interface RatioResult {
  name: string;
  value: number;
  formula: string;
  benchmark?: number;
  status: "good" | "warning" | "poor" | "neutral";
}

export class RatioService {
  constructor(private store: DbStore, private reporting: ReportingService) {}

  // ============ LIQUIDITY RATIOS ============
  currentRatio(orgId: string, period?: string): RatioResult {
    const bs = this.reporting.balanceSheet(orgId, period);
    const currentAssets = bs.totals.assets;
    const currentLiabilities = bs.totals.liabilities;

    const value = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;

    return {
      name: "Current Ratio",
      value,
      formula: "Current Assets / Current Liabilities",
      benchmark: 2.0,
      status: value >= 2 ? "good" : value >= 1 ? "warning" : "poor"
    };
  }

  quickRatio(orgId: string, period?: string): RatioResult {
    const bs = this.reporting.balanceSheet(orgId, period);
    // Simplified: assume 80% of assets are quick assets (cash + receivables)
    const quickAssets = bs.totals.assets * 0.8;
    const currentLiabilities = bs.totals.liabilities;

    const value = currentLiabilities > 0 ? quickAssets / currentLiabilities : 0;

    return {
      name: "Quick Ratio (Acid Test)",
      value,
      formula: "(Cash + Receivables) / Current Liabilities",
      benchmark: 1.0,
      status: value >= 1 ? "good" : value >= 0.5 ? "warning" : "poor"
    };
  }

  cashRatio(orgId: string, period?: string): RatioResult {
    const bs = this.reporting.balanceSheet(orgId, period);
    // Simplified: assume 30% of assets are cash
    const cash = bs.totals.assets * 0.3;
    const currentLiabilities = bs.totals.liabilities;

    const value = currentLiabilities > 0 ? cash / currentLiabilities : 0;

    return {
      name: "Cash Ratio",
      value,
      formula: "Cash / Current Liabilities",
      benchmark: 0.5,
      status: value >= 0.5 ? "good" : value >= 0.2 ? "warning" : "poor"
    };
  }

  // ============ PROFITABILITY RATIOS ============
  grossMargin(orgId: string, period?: string): RatioResult {
    const is = this.reporting.incomeStatement(orgId, period);
    const revenue = is.totals.revenue;
    const cogs = is.totals.expenses * 0.6; // Simplified: assume 60% of expenses are COGS

    const grossProfit = revenue - cogs;
    const value = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      name: "Gross Margin",
      value,
      formula: "(Revenue - COGS) / Revenue × 100",
      benchmark: 40,
      status: value >= 40 ? "good" : value >= 20 ? "warning" : "poor"
    };
  }

  netProfitMargin(orgId: string, period?: string): RatioResult {
    const is = this.reporting.incomeStatement(orgId, period);
    const revenue = is.totals.revenue;
    const netIncome = is.totals.netIncome;

    const value = revenue > 0 ? (netIncome / revenue) * 100 : 0;

    return {
      name: "Net Profit Margin",
      value,
      formula: "Net Income / Revenue × 100",
      benchmark: 10,
      status: value >= 10 ? "good" : value >= 5 ? "warning" : "poor"
    };
  }

  operatingMargin(orgId: string, period?: string): RatioResult {
    const is = this.reporting.incomeStatement(orgId, period);
    const revenue = is.totals.revenue;
    const operatingExpenses = is.totals.expenses * 0.8; // Simplified
    const operatingIncome = revenue - operatingExpenses;

    const value = revenue > 0 ? (operatingIncome / revenue) * 100 : 0;

    return {
      name: "Operating Margin",
      value,
      formula: "Operating Income / Revenue × 100",
      benchmark: 15,
      status: value >= 15 ? "good" : value >= 8 ? "warning" : "poor"
    };
  }

  // ============ RETURN RATIOS ============
  returnOnAssets(orgId: string, period?: string): RatioResult {
    const bs = this.reporting.balanceSheet(orgId, period);
    const is = this.reporting.incomeStatement(orgId, period);

    const totalAssets = bs.totals.assets;
    const netIncome = is.totals.netIncome;

    const value = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;

    return {
      name: "Return on Assets (ROA)",
      value,
      formula: "Net Income / Total Assets × 100",
      benchmark: 5,
      status: value >= 5 ? "good" : value >= 2 ? "warning" : "poor"
    };
  }

  returnOnEquity(orgId: string, period?: string): RatioResult {
    const bs = this.reporting.balanceSheet(orgId, period);
    const is = this.reporting.incomeStatement(orgId, period);

    const equity = bs.totals.equity;
    const netIncome = is.totals.netIncome;

    const value = equity > 0 ? (netIncome / equity) * 100 : 0;

    return {
      name: "Return on Equity (ROE)",
      value,
      formula: "Net Income / Shareholders Equity × 100",
      benchmark: 15,
      status: value >= 15 ? "good" : value >= 8 ? "warning" : "poor"
    };
  }

  // ============ LEVERAGE RATIOS ============
  debtToEquity(orgId: string, period?: string): RatioResult {
    const bs = this.reporting.balanceSheet(orgId, period);
    const totalDebt = bs.totals.liabilities;
    const equity = bs.totals.equity;

    const value = equity > 0 ? totalDebt / equity : 0;

    return {
      name: "Debt to Equity",
      value,
      formula: "Total Debt / Shareholders Equity",
      benchmark: 1.5,
      status: value <= 1.5 ? "good" : value <= 2.5 ? "warning" : "poor"
    };
  }

  debtRatio(orgId: string, period?: string): RatioResult {
    const bs = this.reporting.balanceSheet(orgId, period);
    const totalDebt = bs.totals.liabilities;
    const totalAssets = bs.totals.assets;

    const value = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

    return {
      name: "Debt Ratio",
      value,
      formula: "Total Debt / Total Assets × 100",
      benchmark: 50,
      status: value <= 50 ? "good" : value <= 70 ? "warning" : "poor"
    };
  }

  // ============ EFFICIENCY RATIOS ============
  assetTurnover(orgId: string, period?: string): RatioResult {
    const bs = this.reporting.balanceSheet(orgId, period);
    const is = this.reporting.incomeStatement(orgId, period);

    const revenue = is.totals.revenue;
    const totalAssets = bs.totals.assets;

    const value = totalAssets > 0 ? revenue / totalAssets : 0;

    return {
      name: "Asset Turnover",
      value,
      formula: "Revenue / Total Assets",
      benchmark: 1.0,
      status: value >= 1 ? "good" : value >= 0.5 ? "warning" : "poor"
    };
  }

  // ============ DASHBOARD ============
  allRatios(orgId: string, period?: string): RatioResult[] {
    return [
      // Liquidity
      this.currentRatio(orgId, period),
      this.quickRatio(orgId, period),
      this.cashRatio(orgId, period),
      // Profitability
      this.grossMargin(orgId, period),
      this.netProfitMargin(orgId, period),
      this.operatingMargin(orgId, period),
      // Returns
      this.returnOnAssets(orgId, period),
      this.returnOnEquity(orgId, period),
      // Leverage
      this.debtToEquity(orgId, period),
      this.debtRatio(orgId, period),
      // Efficiency
      this.assetTurnover(orgId, period)
    ];
  }

  dashboard(orgId: string, period?: string) {
    const ratios = this.allRatios(orgId, period);

    const good = ratios.filter((r) => r.status === "good").length;
    const warning = ratios.filter((r) => r.status === "warning").length;
    const poor = ratios.filter((r) => r.status === "poor").length;

    return {
      period,
      ratios,
      summary: {
        total: ratios.length,
        good,
        warning,
        poor,
        healthScore: Math.round((good / ratios.length) * 100)
      }
    };
  }

  trend(orgId: string, periods: string[]) {
    return periods.map((period) => ({
      period,
      ratios: this.allRatios(orgId, period)
    }));
  }
}



