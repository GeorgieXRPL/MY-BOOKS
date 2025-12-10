import { Account, AccountType } from "./types";
import { v4 as uuid } from "uuid";

export const buildDefaultCoa = (orgId: string, currency = "USD"): Account[] => {
  const accounts: Array<[string, string, AccountType]> = [
    ["1000", "Cash", AccountType.Asset],
    ["1100", "Bank Accounts", AccountType.Asset],
    ["1200", "Crypto Assets - Treasury", AccountType.Asset],
    ["1210", "Crypto Assets - Ops", AccountType.Asset],
    ["1220", "CEX Balances", AccountType.Asset],
    ["1300", "Stablecoins", AccountType.Asset],
    ["1400", "Receivables", AccountType.Asset],
    ["1500", "Prepaid & Deposits", AccountType.Asset],
    ["2000", "Accounts Payable", AccountType.Liability],
    ["2100", "Deferred Revenue", AccountType.Liability],
    ["2200", "Token Sale Liability", AccountType.Liability],
    ["2300", "Gas/Network Fees Payable", AccountType.Liability],
    ["2400", "Taxes Payable", AccountType.Liability],
    ["3000", "Equity", AccountType.Equity],
    ["4000", "Revenue", AccountType.Revenue],
    ["4100", "Token Revenue", AccountType.Revenue],
    ["4200", "Realized Gains", AccountType.Revenue],
    ["4300", "Unrealized Gains", AccountType.Revenue],
    ["5000", "Operating Expenses", AccountType.Expense],
    ["5100", "Gas/Network Fees", AccountType.Expense],
    ["5200", "Impairment Expense", AccountType.Expense],
    ["5300", "FX Loss", AccountType.Expense]
  ];

  return accounts.map(([code, name, type]) => ({
    id: uuid(),
    orgId,
    code,
    name,
    type,
    currency,
    isActive: true
  }));
};



