/**
 * XRPL (XRP Ledger) Fetcher
 * Fetches transaction data from the XRP Ledger
 */

import axios from "axios";
import { BlockchainTx, FetcherResult, CHAIN_CONFIGS } from "../types";
import { logger } from "../../../utils/logger";

// Public XRPL servers
const XRPL_SERVERS = [
  "https://xrplcluster.com",
  "https://s1.ripple.com:51234",
  "https://s2.ripple.com:51234"
];

interface XRPLPayment {
  Account: string;
  Destination: string;
  Amount: string | { currency: string; value: string; issuer: string };
  Fee: string;
  TransactionType: string;
  Sequence: number;
  hash: string;
  ledger_index: number;
  date: number;
  meta?: {
    TransactionResult: string;
    delivered_amount?: string | { currency: string; value: string; issuer: string };
  };
  DestinationTag?: number;
  Memos?: Array<{ Memo: { MemoType?: string; MemoData?: string } }>;
}

/**
 * Fetch XRPL transaction
 */
export async function fetchXRPLTransaction(txHash: string): Promise<FetcherResult> {
  for (const server of XRPL_SERVERS) {
    try {
      const response = await axios.post(server, {
        method: "tx",
        params: [{
          transaction: txHash,
          binary: false
        }]
      }, {
        timeout: 10000,
        headers: { "Content-Type": "application/json" }
      });

      const result = response.data.result;
      
      if (result.status === "error" || !result.validated) {
        continue; // Try next server
      }

      return parseXRPLTransaction(result);
    } catch (error: any) {
      logger.warn(`XRPL fetch failed from ${server}`, { error: error.message });
      continue;
    }
  }

  return { success: false, error: "Transaction not found on XRPL" };
}

/**
 * Parse XRPL transaction response
 */
function parseXRPLTransaction(tx: XRPLPayment): FetcherResult {
  const chainConfig = CHAIN_CONFIGS.xrpl;

  // Parse amount
  let valueXRP = 0;
  let tokenSymbol = chainConfig.nativeSymbol;
  
  if (typeof tx.Amount === "string") {
    // Native XRP (in drops, 1 XRP = 1,000,000 drops)
    valueXRP = parseInt(tx.Amount) / 1_000_000;
  } else if (tx.Amount && typeof tx.Amount === "object") {
    // Issued currency
    valueXRP = parseFloat(tx.Amount.value);
    tokenSymbol = tx.Amount.currency;
  }

  // Parse fee (always in drops)
  const feeXRP = parseInt(tx.Fee) / 1_000_000;

  // XRPL epoch starts from 2000-01-01
  const RIPPLE_EPOCH = 946684800;
  const timestamp = tx.date ? new Date((tx.date + RIPPLE_EPOCH) * 1000).toISOString() : undefined;

  // Parse status
  const status = tx.meta?.TransactionResult === "tesSUCCESS" ? "success" : "failed";

  // Parse memos
  let memo: string | undefined;
  if (tx.Memos && tx.Memos.length > 0) {
    try {
      const memoData = tx.Memos[0].Memo.MemoData;
      if (memoData) {
        memo = Buffer.from(memoData, "hex").toString("utf-8");
      }
    } catch {
      // Ignore memo parsing errors
    }
  }

  const blockchainTx: BlockchainTx = {
    chain: "xrpl",
    txHash: tx.hash,
    blockNumber: tx.ledger_index,
    blockTime: timestamp,
    from: tx.Account,
    to: tx.Destination || "",
    value: typeof tx.Amount === "string" ? tx.Amount : tx.Amount?.value || "0",
    valueDecimal: valueXRP,
    tokenSymbol,
    fee: feeXRP,
    status,
    memo,
    rawData: tx as unknown as Record<string, unknown>
  };

  return { success: true, tx: blockchainTx };
}

/**
 * Get account transactions (for future use)
 */
export async function getAccountTransactions(account: string, limit = 20): Promise<XRPLPayment[]> {
  try {
    const response = await axios.post(XRPL_SERVERS[0], {
      method: "account_tx",
      params: [{
        account,
        limit,
        forward: false
      }]
    });

    if (response.data.result.status === "success") {
      return response.data.result.transactions.map((t: any) => t.tx);
    }
  } catch (error) {
    logger.error("XRPL account_tx error", error);
  }
  return [];
}


