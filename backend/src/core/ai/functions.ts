/**
 * AI Function Definitions
 * Available functions the AI can call
 */

import { FunctionDefinition } from "./types";

export const AI_FUNCTIONS: FunctionDefinition[] = [
  {
    name: "get_account_balance",
    description: "Get the balance of a specific account or list all account balances",
    parameters: {
      type: "object",
      properties: {
        accountName: {
          type: "string",
          description: "Name of the account to query (e.g., 'Cash', 'Accounts Receivable')"
        }
      },
      required: []
    }
  },
  {
    name: "list_invoices",
    description: "List invoices with optional filters",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["receivable", "payable"],
          description: "Filter by invoice type"
        },
        status: {
          type: "string",
          enum: ["draft", "sent", "paid", "overdue"],
          description: "Filter by invoice status"
        },
        minAmount: {
          type: "number",
          description: "Minimum invoice amount"
        }
      },
      required: []
    }
  },
  {
    name: "get_financial_summary",
    description: "Get a financial summary including total revenue, expenses, and profit for a period",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Period to query (e.g., '2024-01' for January 2024)"
        }
      },
      required: []
    }
  },
  {
    name: "explain_transaction",
    description: "Explain what a specific transaction or journal entry represents",
    parameters: {
      type: "object",
      properties: {
        transactionId: {
          type: "string",
          description: "ID of the journal entry or transaction to explain"
        }
      },
      required: ["transactionId"]
    }
  },
  {
    name: "suggest_account_mapping",
    description: "Suggest which account a transaction should be mapped to based on its description",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Description of the transaction"
        },
        amount: {
          type: "number",
          description: "Transaction amount"
        },
        type: {
          type: "string",
          enum: ["income", "expense"],
          description: "Whether this is income or expense"
        }
      },
      required: ["description"]
    }
  },
  {
    name: "get_crypto_holdings",
    description: "Get current cryptocurrency holdings and their values",
    parameters: {
      type: "object",
      properties: {
        tokenSymbol: {
          type: "string",
          description: "Specific token symbol to query (e.g., 'ETH', 'BTC')"
        }
      },
      required: []
    }
  },
  {
    name: "calculate_ratio",
    description: "Calculate a financial ratio",
    parameters: {
      type: "object",
      properties: {
        ratioName: {
          type: "string",
          enum: ["current_ratio", "quick_ratio", "debt_to_equity", "profit_margin", "roa", "roe"],
          description: "Name of the ratio to calculate"
        }
      },
      required: ["ratioName"]
    }
  },
  {
    name: "search_transactions",
    description: "Search for transactions by keyword, date range, or amount",
    parameters: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Search keyword in transaction description"
        },
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD)"
        },
        endDate: {
          type: "string",
          description: "End date (YYYY-MM-DD)"
        }
      },
      required: []
    }
  },
  {
    name: "get_overdue_invoices",
    description: "Get list of overdue invoices with total amount owed",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "explain_report",
    description: "Explain what a financial report (Balance Sheet, Income Statement, etc.) shows",
    parameters: {
      type: "object",
      properties: {
        reportType: {
          type: "string",
          enum: ["balance_sheet", "income_statement", "cash_flow", "trial_balance"],
          description: "Type of report to explain"
        }
      },
      required: ["reportType"]
    }
  }
];

/**
 * Get function definitions in OpenAI format
 */
export function getOpenAIFunctions() {
  return AI_FUNCTIONS.map(fn => ({
    type: "function" as const,
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters
    }
  }));
}


