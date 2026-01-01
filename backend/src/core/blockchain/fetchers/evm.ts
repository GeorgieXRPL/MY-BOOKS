/**
 * EVM Chain Fetcher
 * Fetches transaction data from Ethereum, Polygon, Arbitrum, Base, etc.
 * Uses Alchemy or Etherscan APIs
 */

import axios from "axios";
import { BlockchainTx, FetcherResult, CHAIN_CONFIGS } from "../types";
import { logger } from "../../../utils/logger";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// Network configurations with public RPC fallbacks
const NETWORKS = {
  ethereum: {
    alchemyUrl: ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null,
    publicRpcUrl: "https://eth.llamarpc.com", // Free public RPC
    etherscanUrl: "https://api.etherscan.io/api",
    chainId: 1
  },
  polygon: {
    alchemyUrl: ALCHEMY_API_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null,
    publicRpcUrl: "https://polygon.llamarpc.com",
    etherscanUrl: "https://api.polygonscan.com/api",
    chainId: 137
  },
  arbitrum: {
    alchemyUrl: ALCHEMY_API_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null,
    publicRpcUrl: "https://arbitrum.llamarpc.com",
    etherscanUrl: "https://api.arbiscan.io/api",
    chainId: 42161
  },
  base: {
    alchemyUrl: ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null,
    publicRpcUrl: "https://base.llamarpc.com",
    etherscanUrl: "https://api.basescan.org/api",
    chainId: 8453
  }
};

type NetworkKey = keyof typeof NETWORKS;

interface EVMTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed?: string;
  blockNumber: string;
  timeStamp?: string;
  isError?: string;
  input?: string;
}

interface EVMReceipt {
  status: string;
  gasUsed: string;
  effectiveGasPrice?: string;
  logs: any[];
}

/**
 * Fetch EVM transaction using JSON-RPC (Alchemy or public fallback)
 */
async function fetchFromRPC(txHash: string, network: NetworkKey): Promise<FetcherResult> {
  const config = NETWORKS[network];
  
  // Use Alchemy if configured, otherwise use public RPC
  const rpcUrl = config.alchemyUrl || config.publicRpcUrl;
  
  if (!rpcUrl) {
    return { success: false, error: `No RPC endpoint available for ${network}` };
  }

  const isPublicRpc = !config.alchemyUrl;
  if (isPublicRpc) {
    logger.info(`Using public RPC for ${network} (no ALCHEMY_API_KEY configured)`);
  }

  try {
    // Get transaction
    const txResponse = await axios.post(rpcUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionByHash",
      params: [txHash]
    }, { timeout: 10000 });

    const tx = txResponse.data.result;
    if (!tx) {
      return { success: false, error: "Transaction not found" };
    }

    // Get transaction receipt for status and gas used
    const receiptResponse = await axios.post(rpcUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "eth_getTransactionReceipt",
      params: [txHash]
    }, { timeout: 10000 });

    const receipt: EVMReceipt = receiptResponse.data.result;

    // Get block for timestamp
    const blockResponse = await axios.post(rpcUrl, {
      jsonrpc: "2.0",
      id: 3,
      method: "eth_getBlockByNumber",
      params: [tx.blockNumber, false]
    }, { timeout: 10000 });

    const block = blockResponse.data.result;
    const blockTime = block ? new Date(parseInt(block.timestamp, 16) * 1000).toISOString() : undefined;

    // Calculate values
    const valueWei = BigInt(tx.value);
    const valueEth = Number(valueWei) / 1e18;

    // Calculate gas fee
    const gasUsed = receipt ? BigInt(receipt.gasUsed) : BigInt(tx.gas);
    const gasPrice = BigInt(receipt?.effectiveGasPrice || tx.gasPrice);
    const feeWei = gasUsed * gasPrice;
    const feeEth = Number(feeWei) / 1e18;

    // Determine status
    const status = receipt 
      ? (receipt.status === "0x1" ? "success" : "failed")
      : "pending";

    const chainConfig = CHAIN_CONFIGS.evm;

    const blockchainTx: BlockchainTx = {
      chain: "evm",
      txHash: tx.hash,
      blockNumber: parseInt(tx.blockNumber, 16),
      blockTime,
      from: tx.from,
      to: tx.to || "", // Contract creation has no 'to'
      value: tx.value,
      valueDecimal: valueEth,
      tokenSymbol: chainConfig.nativeSymbol,
      fee: feeEth,
      status,
      rawData: { tx, receipt, network }
    };

    return { success: true, tx: blockchainTx };
  } catch (error: any) {
    logger.error("EVM fetch error", { error: error.message, txHash, network });
    return { success: false, error: error.message };
  }
}

/**
 * Try to fetch from multiple networks
 */
export async function fetchEVMTransaction(txHash: string, preferredNetwork?: NetworkKey): Promise<FetcherResult> {
  // If preferred network specified, try that first
  if (preferredNetwork) {
    const result = await fetchFromRPC(txHash, preferredNetwork);
    if (result.success) return result;
  }

  // Otherwise, try networks in order of popularity
  const networks: NetworkKey[] = ["ethereum", "polygon", "arbitrum", "base"];
  
  for (const network of networks) {
    if (network === preferredNetwork) continue; // Already tried
    
    try {
      const result = await fetchFromRPC(txHash, network);
      if (result.success) {
        logger.info(`Found EVM tx on ${network}`, { txHash });
        return result;
      }
    } catch (err: any) {
      logger.warn(`Failed to check ${network}`, { error: err.message });
      // Continue to next network
    }
  }

  return { success: false, error: "Transaction not found on any EVM network. Try again in a moment." };
}

/**
 * Parse ERC20 transfer from logs
 */
export function parseERC20Transfer(logs: any[]): { tokenAddress: string; from: string; to: string; value: bigint } | null {
  // ERC20 Transfer event signature
  const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

  for (const log of logs) {
    if (log.topics[0] === TRANSFER_TOPIC && log.topics.length >= 3) {
      return {
        tokenAddress: log.address,
        from: "0x" + log.topics[1].slice(26),
        to: "0x" + log.topics[2].slice(26),
        value: BigInt(log.data)
      };
    }
  }
  return null;
}


