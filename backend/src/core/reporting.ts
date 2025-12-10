import { AccountType } from "./types";
import { LedgerService } from "./ledger";

export class ReportingService {
  constructor(private store: any, private ledger: LedgerService) {}

  balanceSheet(orgId: string, period?: string) {
    const balances = this.ledger.balances(orgId, period);
    const accounts = this.store.listAccounts(orgId);
    const assets: Record<string, number> = {};
    const liabilities: Record<string, number> = {};
    const equity: Record<string, number> = {};

    balances.forEach((amount, accountId) => {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return;
      if (account.type === AccountType.Asset) assets[account.name] = amount;
      if (account.type === AccountType.Liability) liabilities[account.name] = amount;
      if (account.type === AccountType.Equity) equity[account.name] = amount;
    });

    const sum = (obj: Record<string, number>) => Object.values(obj).reduce((s, v) => s + v, 0);
    return {
      assets,
      liabilities,
      equity,
      totals: {
        assets: sum(assets),
        liabilities: sum(liabilities),
        equity: sum(equity)
      }
    };
  }

  incomeStatement(orgId: string, period?: string) {
    const balances = this.ledger.balances(orgId, period);
    const accounts = this.store.listAccounts(orgId);
    const revenue: Record<string, number> = {};
    const expenses: Record<string, number> = {};

    balances.forEach((amount, accountId) => {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return;
      if (account.type === AccountType.Revenue) revenue[account.name] = amount;
      if (account.type === AccountType.Expense) expenses[account.name] = amount;
    });

    const sum = (obj: Record<string, number>) => Object.values(obj).reduce((s, v) => s + v, 0);
    const totalRevenue = sum(revenue);
    const totalExpenses = sum(expenses);
    return {
      revenue,
      expenses,
      totals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netIncome: totalRevenue - totalExpenses
      }
    };
  }

  cashFlow(orgId: string, period?: string) {
    const income = this.incomeStatement(orgId, period);
    // Simplified CF: use net income as proxy; real implementation would map accounts
    return {
      operating: income.totals.netIncome,
      investing: 0,
      financing: 0,
      netChange: income.totals.netIncome
    };
  }

  treasury(orgId: string) {
    const balances = this.ledger.balances(orgId);
    const accounts = this.store.listAccounts(orgId);
    const wallets = this.store.listWallets(orgId);

    const treasuryAccounts = accounts.filter((a) => a.name.toLowerCase().includes("crypto"));
    const stableAccounts = accounts.filter((a) => a.name.toLowerCase().includes("stable"));

    const getBalance = (acc: typeof accounts[number]) => balances.get(acc.id) ?? 0;
    return {
      wallets,
      crypto: treasuryAccounts.map((a) => ({ account: a.name, balance: getBalance(a) })),
      stablecoins: stableAccounts.map((a) => ({ account: a.name, balance: getBalance(a) }))
    };
  }
}

