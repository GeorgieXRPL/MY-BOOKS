/**
 * AI Function Executor
 * Executes function calls from the AI
 */

import { FunctionCall, ChatContext } from "./types";
import { logger } from "../../utils/logger";

export class FunctionExecutor {
  constructor(private store: any, private services: {
    ledger?: any;
    reporting?: any;
    invoices?: any;
    crypto?: any;
    ratios?: any;
  }) {}

  /**
   * Execute a function call and return the result
   */
  async execute(call: FunctionCall, context: ChatContext): Promise<string> {
    const { name, arguments: args } = call;
    const { orgId } = context;

    logger.info("Executing AI function", { name, args });

    try {
      switch (name) {
        case "get_account_balance":
          return await this.getAccountBalance(orgId, args.accountName);

        case "list_invoices":
          return await this.listInvoices(orgId, args);

        case "get_financial_summary":
          return await this.getFinancialSummary(orgId, args.period);

        case "explain_transaction":
          return await this.explainTransaction(orgId, args.transactionId);

        case "suggest_account_mapping":
          return this.suggestAccountMapping(args);

        case "get_crypto_holdings":
          return await this.getCryptoHoldings(orgId, args.tokenSymbol);

        case "calculate_ratio":
          return await this.calculateRatio(orgId, args.ratioName);

        case "search_transactions":
          return await this.searchTransactions(orgId, args);

        case "get_overdue_invoices":
          return await this.getOverdueInvoices(orgId);

        case "explain_report":
          return this.explainReport(args.reportType);

        default:
          return `Unknown function: ${name}`;
      }
    } catch (error: any) {
      logger.error("Function execution error", { name, error: error.message });
      return `Error executing ${name}: ${error.message}`;
    }
  }

  private async getAccountBalance(orgId: string, accountName?: string): Promise<string> {
    const accounts = await Promise.resolve(this.store.listAccounts(orgId));
    const journals = await Promise.resolve(this.store.listJournals(orgId));

    // Calculate balances
    const balances: Record<string, number> = {};
    for (const journal of journals) {
      if (journal.status === "posted") {
        for (const line of journal.lines || []) {
          const account = accounts.find((a: any) => a.id === line.accountId);
          if (account) {
            balances[account.name] = (balances[account.name] || 0) + (line.debit || 0) - (line.credit || 0);
          }
        }
      }
    }

    if (accountName) {
      const matchingAccount = Object.entries(balances).find(
        ([name]) => name.toLowerCase().includes(accountName.toLowerCase())
      );
      if (matchingAccount) {
        return `${matchingAccount[0]}: $${matchingAccount[1].toFixed(2)}`;
      }
      return `No account found matching "${accountName}"`;
    }

    // Return top 10 accounts by absolute balance
    const sorted = Object.entries(balances)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 10);
    
    if (sorted.length === 0) {
      return "No account balances found. The ledger may be empty.";
    }

    return "Account Balances:\n" + sorted
      .map(([name, balance]) => `- ${name}: $${balance.toFixed(2)}`)
      .join("\n");
  }

  private async listInvoices(orgId: string, filters: any): Promise<string> {
    let invoices = await Promise.resolve(this.store.listInvoices(orgId));

    if (filters.type) {
      invoices = invoices.filter((i: any) => i.type === filters.type);
    }
    if (filters.status) {
      invoices = invoices.filter((i: any) => i.status === filters.status);
    }
    if (filters.minAmount) {
      invoices = invoices.filter((i: any) => i.total >= filters.minAmount);
    }

    if (invoices.length === 0) {
      return "No invoices found matching the criteria.";
    }

    const total = invoices.reduce((sum: number, i: any) => sum + i.total, 0);
    
    return `Found ${invoices.length} invoices (Total: $${total.toFixed(2)}):\n` +
      invoices.slice(0, 10).map((i: any) => 
        `- ${i.invoiceNumber}: ${i.counterpartyName} - $${i.total.toFixed(2)} (${i.status})`
      ).join("\n");
  }

  private async getFinancialSummary(orgId: string, period?: string): Promise<string> {
    const invoices = await Promise.resolve(this.store.listInvoices(orgId));
    const expenses = await Promise.resolve(this.store.listExpenses(orgId));

    const currentPeriod = period || new Date().toISOString().slice(0, 7);
    
    const periodInvoices = invoices.filter((i: any) => 
      i.issueDate?.startsWith(currentPeriod)
    );
    const periodExpenses = expenses.filter((e: any) => 
      e.date?.startsWith(currentPeriod)
    );

    const revenue = periodInvoices
      .filter((i: any) => i.type === "receivable" && i.status === "paid")
      .reduce((sum: number, i: any) => sum + i.total, 0);

    const expenseTotal = periodExpenses
      .reduce((sum: number, e: any) => sum + e.amount, 0);

    const profit = revenue - expenseTotal;

    return `Financial Summary for ${currentPeriod}:
- Revenue: $${revenue.toFixed(2)}
- Expenses: $${expenseTotal.toFixed(2)}
- Profit/Loss: $${profit.toFixed(2)} (${profit >= 0 ? "Profit" : "Loss"})
- Invoices Sent: ${periodInvoices.filter((i: any) => i.type === "receivable").length}
- Bills Received: ${periodInvoices.filter((i: any) => i.type === "payable").length}`;
  }

  private async explainTransaction(orgId: string, transactionId: string): Promise<string> {
    const journal = await Promise.resolve(this.store.getJournal(transactionId));
    
    if (!journal) {
      return `Transaction with ID "${transactionId}" not found.`;
    }

    const accounts = await Promise.resolve(this.store.listAccounts(orgId));
    const getAccountName = (id: string) => accounts.find((a: any) => a.id === id)?.name || id;

    const lines = (journal.lines || []).map((l: any) => {
      const accountName = getAccountName(l.accountId);
      if (l.debit > 0) {
        return `  Debit ${accountName}: $${l.debit.toFixed(2)}`;
      } else {
        return `  Credit ${accountName}: $${l.credit.toFixed(2)}`;
      }
    });

    return `Transaction ${journal.id}:
- Status: ${journal.status}
- Period: ${journal.period}
- Memo: ${journal.memo || "None"}
- Created: ${journal.createdAt}
Entries:
${lines.join("\n")}`;
  }

  private suggestAccountMapping(args: any): string {
    const { description, type } = args;
    const desc = description.toLowerCase();

    // Simple rule-based suggestions
    const suggestions: Record<string, string> = {
      // Income
      "consulting": "Consulting Revenue",
      "service": "Service Revenue",
      "sale": "Sales Revenue",
      "subscription": "Subscription Revenue",
      // Expenses
      "office": "Office Supplies",
      "software": "Software & Subscriptions",
      "hosting": "Cloud & Hosting",
      "travel": "Travel & Entertainment",
      "meal": "Meals & Entertainment",
      "salary": "Salaries & Wages",
      "rent": "Rent Expense",
      "insurance": "Insurance",
      "legal": "Professional Services",
      "marketing": "Marketing & Advertising",
      "gas": "Gas/Network Fees",
    };

    for (const [keyword, account] of Object.entries(suggestions)) {
      if (desc.includes(keyword)) {
        return `Suggested account for "${description}": ${account}`;
      }
    }

    return type === "income" 
      ? `Suggested account: Other Revenue`
      : `Suggested account: Other Operating Expenses`;
  }

  private async getCryptoHoldings(orgId: string, tokenSymbol?: string): Promise<string> {
    const lots = await Promise.resolve(this.store.listCryptoLots(orgId, tokenSymbol));

    if (lots.length === 0) {
      return tokenSymbol 
        ? `No holdings found for ${tokenSymbol}`
        : "No cryptocurrency holdings found.";
    }

    // Aggregate by token
    const holdings: Record<string, { quantity: number; costBasis: number }> = {};
    for (const lot of lots) {
      if (!holdings[lot.tokenSymbol]) {
        holdings[lot.tokenSymbol] = { quantity: 0, costBasis: 0 };
      }
      holdings[lot.tokenSymbol].quantity += lot.remainingQty || lot.quantity;
      holdings[lot.tokenSymbol].costBasis += lot.costBasisUsd;
    }

    return "Crypto Holdings:\n" + Object.entries(holdings)
      .map(([symbol, data]) => 
        `- ${symbol}: ${data.quantity.toFixed(6)} (Cost Basis: $${data.costBasis.toFixed(2)})`
      ).join("\n");
  }

  private async calculateRatio(orgId: string, ratioName: string): Promise<string> {
    // Simplified ratio calculations
    const accounts = await Promise.resolve(this.store.listAccounts(orgId));
    const journals = await Promise.resolve(this.store.listJournals(orgId));

    // Calculate rough balances
    const balances: Record<string, number> = {};
    for (const journal of journals.filter((j: any) => j.status === "posted")) {
      for (const line of journal.lines || []) {
        balances[line.accountId] = (balances[line.accountId] || 0) + (line.debit || 0) - (line.credit || 0);
      }
    }

    const getTypeTotal = (type: string) => {
      return accounts
        .filter((a: any) => a.type === type)
        .reduce((sum: number, a: any) => sum + (balances[a.id] || 0), 0);
    };

    const currentAssets = getTypeTotal("asset");
    const currentLiabilities = Math.abs(getTypeTotal("liability"));
    const equity = Math.abs(getTypeTotal("equity"));
    const revenue = Math.abs(getTypeTotal("revenue"));
    const expenses = getTypeTotal("expense");

    switch (ratioName) {
      case "current_ratio":
        const cr = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
        return `Current Ratio: ${cr.toFixed(2)} (Assets: $${currentAssets.toFixed(0)} / Liabilities: $${currentLiabilities.toFixed(0)})`;
      
      case "debt_to_equity":
        const de = equity > 0 ? currentLiabilities / equity : 0;
        return `Debt to Equity: ${de.toFixed(2)}`;
      
      case "profit_margin":
        const profit = revenue - expenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return `Profit Margin: ${margin.toFixed(1)}% (Profit: $${profit.toFixed(0)} / Revenue: $${revenue.toFixed(0)})`;
      
      default:
        return `Ratio ${ratioName} calculation not implemented.`;
    }
  }

  private async searchTransactions(orgId: string, args: any): Promise<string> {
    const journals = await Promise.resolve(this.store.listJournals(orgId));
    
    let filtered = journals;

    if (args.keyword) {
      const kw = args.keyword.toLowerCase();
      filtered = filtered.filter((j: any) => 
        j.memo?.toLowerCase().includes(kw) ||
        j.lines?.some((l: any) => l.description?.toLowerCase().includes(kw))
      );
    }

    if (args.startDate) {
      filtered = filtered.filter((j: any) => j.createdAt >= args.startDate);
    }

    if (args.endDate) {
      filtered = filtered.filter((j: any) => j.createdAt <= args.endDate);
    }

    if (filtered.length === 0) {
      return "No transactions found matching the criteria.";
    }

    return `Found ${filtered.length} transactions:\n` +
      filtered.slice(0, 5).map((j: any) => 
        `- ${j.id.slice(0, 8)}... (${j.period}): ${j.memo || "No memo"} [${j.status}]`
      ).join("\n");
  }

  private async getOverdueInvoices(orgId: string): Promise<string> {
    const invoices = await Promise.resolve(this.store.listInvoices(orgId));
    const today = new Date().toISOString().split("T")[0];
    
    const overdue = invoices.filter((i: any) => 
      i.status !== "paid" && i.dueDate && i.dueDate < today
    );

    if (overdue.length === 0) {
      return "No overdue invoices. Great job staying on top of payments!";
    }

    const total = overdue.reduce((sum: number, i: any) => sum + i.total, 0);

    return `${overdue.length} Overdue Invoices (Total: $${total.toFixed(2)}):\n` +
      overdue.slice(0, 10).map((i: any) => 
        `- ${i.invoiceNumber}: ${i.counterpartyName} - $${i.total.toFixed(2)} (Due: ${i.dueDate})`
      ).join("\n");
  }

  private explainReport(reportType: string): string {
    const explanations: Record<string, string> = {
      balance_sheet: `The Balance Sheet shows your company's financial position at a point in time:
- Assets: What you own (cash, receivables, equipment, crypto)
- Liabilities: What you owe (payables, loans, taxes)
- Equity: The difference (owner's investment + retained earnings)
The formula: Assets = Liabilities + Equity`,

      income_statement: `The Income Statement (P&L) shows profitability over a period:
- Revenue: Money earned from sales/services
- Expenses: Costs incurred to generate revenue
- Net Income: Revenue minus Expenses
This tells you if you're profitable.`,

      cash_flow: `The Cash Flow Statement shows how cash moves:
- Operating: Cash from normal business (sales, expenses)
- Investing: Cash for assets (equipment, crypto purchases)
- Financing: Cash from/to investors and lenders
This shows if you can pay your bills.`,

      trial_balance: `The Trial Balance lists all accounts with their debit/credit balances.
It's used to verify that total debits equal total credits.
If they don't balance, there's an error in the books.`
    };

    return explanations[reportType] || `Report type "${reportType}" not recognized.`;
  }
}


