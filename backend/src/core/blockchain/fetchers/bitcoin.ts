/**
 * Bitcoin Fetcher
 * Fetches transaction data from Bitcoin blockchain
 * Uses Blockstream or Mempool.space APIs
 */

import axios from "axios";
import { BlockchainTx, FetcherResult, CHAIN_CONFIGS } from "../types";
import { logger } from "../../../utils/logger";

// API endpoints
const BLOCKSTREAM_API = "https://blockstream.info/api";
const MEMPOOL_API = "https://mempool.space/api";

interface BitcoinVin {
  txid: string;
  vout: number;
  prevout?: {
    scriptpubkey: string;
    scriptpubkey_address?: string;
    value: number;
  };
}

interface BitcoinVout {
  scriptpubkey: string;
  scriptpubkey_address?: string;
  value: number;
}

interface BitcoinTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: BitcoinVin[];
  vout: BitcoinVout[];
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Fetch Bitcoin transaction from Blockstream API
 */
async function fetchFromBlockstream(txid: string): Promise<FetcherResult> {
  try {
    const response = await axios.get(`${BLOCKSTREAM_API}/tx/${txid}`, {
      timeout: 10000
    });

    const tx: BitcoinTransaction = response.data;
    return parseBitcoinTransaction(tx);
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { success: false, error: "Transaction not found" };
    }
    logger.warn("Blockstream fetch failed", { error: error.message, txid });
    return { success: false, error: error.message };
  }
}

/**
 * Fetch Bitcoin transaction from Mempool.space API
 */
async function fetchFromMempool(txid: string): Promise<FetcherResult> {
  try {
    const response = await axios.get(`${MEMPOOL_API}/tx/${txid}`, {
      timeout: 10000
    });

    const tx: BitcoinTransaction = response.data;
    return parseBitcoinTransaction(tx);
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { success: false, error: "Transaction not found" };
    }
    logger.warn("Mempool fetch failed", { error: error.message, txid });
    return { success: false, error: error.message };
  }
}

/**
 * Parse Bitcoin transaction
 */
function parseBitcoinTransaction(tx: BitcoinTransaction): FetcherResult {
  const chainConfig = CHAIN_CONFIGS.bitcoin;

  // Get sender address (from first input with prevout)
  const senderAddress = tx.vin.find(vin => vin.prevout?.scriptpubkey_address)?.prevout?.scriptpubkey_address || "";

  // Calculate total input value
  const totalInputValue = tx.vin.reduce((sum, vin) => sum + (vin.prevout?.value || 0), 0);

  // Get outputs - find the primary recipient (largest non-change output)
  // Usually the change goes back to sender, so we look for different addresses
  const outputs = tx.vout.filter(vout => 
    vout.scriptpubkey_address && vout.scriptpubkey_address !== senderAddress
  );
  
  // Sort by value descending and take the largest as primary recipient
  outputs.sort((a, b) => b.value - a.value);
  const primaryOutput = outputs[0];
  
  // Calculate values
  const valueSats = primaryOutput?.value || tx.vout[0]?.value || 0;
  const valueBTC = valueSats / 1e8;
  const feeBTC = tx.fee / 1e8;

  // Block time
  const blockTime = tx.status.block_time 
    ? new Date(tx.status.block_time * 1000).toISOString()
    : undefined;

  const blockchainTx: BlockchainTx = {
    chain: "bitcoin",
    txHash: tx.txid,
    blockNumber: tx.status.block_height,
    blockTime,
    from: senderAddress,
    to: primaryOutput?.scriptpubkey_address || tx.vout[0]?.scriptpubkey_address || "",
    value: valueSats.toString(),
    valueDecimal: valueBTC,
    tokenSymbol: chainConfig.nativeSymbol,
    fee: feeBTC,
    status: tx.status.confirmed ? "success" : "pending",
    rawData: tx as unknown as Record<string, unknown>
  };

  return { success: true, tx: blockchainTx };
}

/**
 * Fetch Bitcoin transaction (tries multiple APIs)
 */
export async function fetchBitcoinTransaction(txid: string): Promise<FetcherResult> {
  // Try Blockstream first
  let result = await fetchFromBlockstream(txid);
  if (result.success) return result;

  // Try Mempool as fallback
  result = await fetchFromMempool(txid);
  if (result.success) return result;

  return { success: false, error: "Transaction not found on Bitcoin network" };
}

/**
 * Get address transactions (for future use)
 */
export async function getAddressTransactions(address: string): Promise<BitcoinTransaction[]> {
  try {
    const response = await axios.get(`${BLOCKSTREAM_API}/address/${address}/txs`);
    return response.data;
  } catch (error) {
    logger.error("Bitcoin address fetch error", error);
    return [];
  }
}

/**
 * Get current Bitcoin fee estimates
 */
export async function getFeeEstimates(): Promise<{ fastestFee: number; halfHourFee: number; hourFee: number } | null> {
  try {
    const response = await axios.get(`${MEMPOOL_API}/v1/fees/recommended`);
    return response.data;
  } catch (error) {
    logger.error("Bitcoin fee estimate error", error);
    return null;
  }
}
