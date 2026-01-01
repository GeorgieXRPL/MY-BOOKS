/**
 * Solana Fetcher
 * Fetches transaction data from Solana blockchain
 * Uses Helius or public RPC endpoints
 */

import axios from "axios";
import { BlockchainTx, FetcherResult, CHAIN_CONFIGS } from "../types";
import { logger } from "../../../utils/logger";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

// RPC endpoints
const RPC_ENDPOINTS = {
  helius: HELIUS_API_KEY 
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : null,
  public: "https://api.mainnet-beta.solana.com"
};

interface SolanaInstruction {
  programId: string;
  data: string;
  accounts: string[];
}

interface SolanaTransfer {
  source: string;
  destination: string;
  amount: number;
  mint?: string;
}

/**
 * Fetch Solana transaction
 */
export async function fetchSolanaTransaction(signature: string): Promise<FetcherResult> {
  const rpcUrl = RPC_ENDPOINTS.helius || RPC_ENDPOINTS.public;

  try {
    // Get transaction with max detail
    const response = await axios.post(rpcUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        { 
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0
        }
      ]
    }, {
      timeout: 15000
    });

    const result = response.data.result;
    
    if (!result) {
      return { success: false, error: "Transaction not found" };
    }

    return parseSolanaTransaction(signature, result);
  } catch (error: any) {
    logger.error("Solana fetch error", { error: error.message, signature });
    return { success: false, error: error.message };
  }
}

/**
 * Parse Solana transaction
 */
function parseSolanaTransaction(signature: string, tx: any): FetcherResult {
  const chainConfig = CHAIN_CONFIGS.solana;

  // Get timestamp
  const blockTime = tx.blockTime 
    ? new Date(tx.blockTime * 1000).toISOString() 
    : undefined;

  // Parse status
  const status = tx.meta?.err ? "failed" : "success";

  // Calculate fee (in lamports, 1 SOL = 1e9 lamports)
  const feeLamports = tx.meta?.fee || 0;
  const feeSOL = feeLamports / 1e9;

  // Parse transfers from inner instructions
  const transfers = parseTransfers(tx);
  
  // Get primary transfer (largest value or first)
  const primaryTransfer = transfers.length > 0 
    ? transfers.reduce((a, b) => a.amount > b.amount ? a : b)
    : null;

  // Get account keys
  const accountKeys = tx.transaction?.message?.accountKeys || [];
  const signerAccount = accountKeys.find((k: any) => k.signer)?.pubkey || accountKeys[0]?.pubkey || "";

  // Calculate value
  let valueSOL = 0;
  let tokenSymbol = chainConfig.nativeSymbol;
  
  if (primaryTransfer) {
    if (primaryTransfer.mint) {
      // SPL token transfer
      tokenSymbol = "SPL"; // Would need token metadata API for symbol
      valueSOL = primaryTransfer.amount;
    } else {
      // Native SOL transfer
      valueSOL = primaryTransfer.amount / 1e9;
    }
  } else {
    // Try to get from pre/post balances
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    if (preBalances.length > 0 && postBalances.length > 0) {
      const change = Math.abs(preBalances[0] - postBalances[0]);
      valueSOL = (change - feeLamports) / 1e9;
    }
  }

  const blockchainTx: BlockchainTx = {
    chain: "solana",
    txHash: signature,
    blockNumber: tx.slot,
    blockTime,
    from: primaryTransfer?.source || signerAccount,
    to: primaryTransfer?.destination || "",
    value: (valueSOL * 1e9).toString(),
    valueDecimal: valueSOL,
    tokenSymbol,
    tokenAddress: primaryTransfer?.mint,
    fee: feeSOL,
    status,
    rawData: tx
  };

  return { success: true, tx: blockchainTx };
}

/**
 * Parse transfers from Solana transaction
 */
function parseTransfers(tx: any): SolanaTransfer[] {
  const transfers: SolanaTransfer[] = [];

  // Check parsed instructions
  const instructions = tx.transaction?.message?.instructions || [];
  
  for (const ix of instructions) {
    if (ix.parsed?.type === "transfer") {
      const info = ix.parsed.info;
      transfers.push({
        source: info.source,
        destination: info.destination,
        amount: parseInt(info.lamports || info.amount || "0")
      });
    } else if (ix.parsed?.type === "transferChecked") {
      const info = ix.parsed.info;
      transfers.push({
        source: info.source,
        destination: info.destination,
        amount: parseFloat(info.tokenAmount?.uiAmount || "0"),
        mint: info.mint
      });
    }
  }

  // Also check inner instructions
  const innerInstructions = tx.meta?.innerInstructions || [];
  for (const inner of innerInstructions) {
    for (const ix of inner.instructions || []) {
      if (ix.parsed?.type === "transfer") {
        const info = ix.parsed.info;
        transfers.push({
          source: info.source,
          destination: info.destination,
          amount: parseInt(info.lamports || info.amount || "0")
        });
      }
    }
  }

  return transfers;
}

/**
 * Enhanced transaction fetch using Helius API (if available)
 */
export async function fetchEnhancedTransaction(signature: string): Promise<FetcherResult> {
  if (!HELIUS_API_KEY) {
    return fetchSolanaTransaction(signature);
  }

  try {
    // Helius enhanced API provides parsed, human-readable data
    const response = await axios.get(
      `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`,
      {
        params: { transactions: [signature] },
        timeout: 10000
      }
    );

    const txs = response.data;
    if (!txs || txs.length === 0) {
      // Fall back to standard RPC
      return fetchSolanaTransaction(signature);
    }

    const tx = txs[0];
    
    // Parse Helius enhanced format
    const chainConfig = CHAIN_CONFIGS.solana;
    
    const blockchainTx: BlockchainTx = {
      chain: "solana",
      txHash: signature,
      blockNumber: tx.slot,
      blockTime: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : undefined,
      from: tx.feePayer || "",
      to: tx.nativeTransfers?.[0]?.toUserAccount || "",
      value: (tx.nativeTransfers?.[0]?.amount || 0).toString(),
      valueDecimal: (tx.nativeTransfers?.[0]?.amount || 0) / 1e9,
      tokenSymbol: chainConfig.nativeSymbol,
      fee: (tx.fee || 0) / 1e9,
      status: tx.transactionError ? "failed" : "success",
      rawData: tx
    };

    return { success: true, tx: blockchainTx };
  } catch (error: any) {
    logger.warn("Helius enhanced fetch failed, falling back", { error: error.message });
    return fetchSolanaTransaction(signature);
  }
}


