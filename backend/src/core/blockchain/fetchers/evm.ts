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
    publicRpcUrl: "https://eth.llamarpc.com",
    etherscanUrl: "https://api.etherscan.io/api",
    chainId: 1,
    nativeSymbol: "ETH",
    name: "Ethereum"
  },
  bsc: {
    alchemyUrl: null, // Alchemy doesn't support BSC
    publicRpcUrl: "https://bsc.publicnode.com",
    etherscanUrl: "https://api.bscscan.com/api",
    chainId: 56,
    nativeSymbol: "BNB",
    name: "BNB Smart Chain"
  },
  polygon: {
    alchemyUrl: ALCHEMY_API_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null,
    publicRpcUrl: "https://polygon.llamarpc.com",
    etherscanUrl: "https://api.polygonscan.com/api",
    chainId: 137,
    nativeSymbol: "MATIC",
    name: "Polygon"
  },
  arbitrum: {
    alchemyUrl: ALCHEMY_API_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null,
    publicRpcUrl: "https://arbitrum.llamarpc.com",
    etherscanUrl: "https://api.arbiscan.io/api",
    chainId: 42161,
    nativeSymbol: "ETH",
    name: "Arbitrum"
  },
  base: {
    alchemyUrl: ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null,
    publicRpcUrl: "https://base.llamarpc.com",
    etherscanUrl: "https://api.basescan.org/api",
    chainId: 8453,
    nativeSymbol: "ETH",
    name: "Base"
  },
  optimism: {
    alchemyUrl: ALCHEMY_API_KEY ? `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null,
    publicRpcUrl: "https://optimism.llamarpc.com",
    etherscanUrl: "https://api-optimistic.etherscan.io/api",
    chainId: 10,
    nativeSymbol: "ETH",
    name: "Optimism"
  },
  avalanche: {
    alchemyUrl: null,
    publicRpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    etherscanUrl: "https://api.snowtrace.io/api",
    chainId: 43114,
    nativeSymbol: "AVAX",
    name: "Avalanche"
  },
  fantom: {
    alchemyUrl: null,
    publicRpcUrl: "https://rpc.ftm.tools",
    etherscanUrl: "https://api.ftmscan.com/api",
    chainId: 250,
    nativeSymbol: "FTM",
    name: "Fantom"
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

    // Use network-specific native symbol
    const nativeSymbol = config.nativeSymbol || "ETH";

    // Check for ERC-20 token transfer
    let tokenSymbol = nativeSymbol;
    let tokenAddress: string | undefined;
    let tokenDecimals: number | undefined;
    let finalValue = valueEth;

    if (receipt?.logs && receipt.logs.length > 0) {
      const erc20Transfer = parseERC20Transfer(receipt.logs);
      if (erc20Transfer) {
        // Try to get token info
        try {
          const tokenInfo = await getTokenInfo(erc20Transfer.tokenAddress, rpcUrl);
          if (tokenInfo) {
            tokenSymbol = tokenInfo.symbol;
            tokenAddress = erc20Transfer.tokenAddress;
            tokenDecimals = tokenInfo.decimals;
            finalValue = Number(erc20Transfer.value) / Math.pow(10, tokenInfo.decimals);
            logger.info(`Detected ERC-20 transfer: ${tokenSymbol}`, { tokenAddress });
          }
        } catch (err) {
          logger.warn("Failed to get token info, using native token", { error: (err as Error).message });
        }
      }
    }

    const blockchainTx: BlockchainTx = {
      chain: "evm",
      txHash: tx.hash,
      blockNumber: parseInt(tx.blockNumber, 16),
      blockTime,
      from: tx.from,
      to: tx.to || "", // Contract creation has no 'to'
      value: tx.value,
      valueDecimal: finalValue,
      tokenSymbol,
      tokenAddress,
      tokenDecimals,
      networkName: config.name,
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
 * Fetch ERC-20 token info (symbol, decimals) from contract
 */
async function getTokenInfo(tokenAddress: string, rpcUrl: string): Promise<{ symbol: string; decimals: number } | null> {
  try {
    // ERC-20 symbol() selector: 0x95d89b41
    const symbolResponse = await axios.post(rpcUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{
        to: tokenAddress,
        data: "0x95d89b41" // symbol()
      }, "latest"]
    }, { timeout: 5000 });

    // ERC-20 decimals() selector: 0x313ce567
    const decimalsResponse = await axios.post(rpcUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "eth_call",
      params: [{
        to: tokenAddress,
        data: "0x313ce567" // decimals()
      }, "latest"]
    }, { timeout: 5000 });

    const symbolHex = symbolResponse.data.result;
    const decimalsHex = decimalsResponse.data.result;

    if (!symbolHex || symbolHex === "0x" || !decimalsHex || decimalsHex === "0x") {
      return null;
    }

    // Decode symbol (string) - skip first 64 chars (offset) + next 64 chars (length)
    let symbol = "";
    try {
      // Handle both padded string and raw bytes
      const data = symbolHex.slice(2); // Remove 0x
      if (data.length >= 128) {
        // Standard ABI encoded string
        const length = parseInt(data.slice(64, 128), 16);
        const hexStr = data.slice(128, 128 + length * 2);
        symbol = Buffer.from(hexStr, "hex").toString("utf8").replace(/\0/g, "");
      } else {
        // Might be bytes32 encoded (like MKR)
        symbol = Buffer.from(data, "hex").toString("utf8").replace(/\0/g, "");
      }
    } catch {
      return null;
    }

    const decimals = parseInt(decimalsHex, 16);

    if (!symbol || isNaN(decimals)) {
      return null;
    }

    return { symbol, decimals };
  } catch (error) {
    logger.warn("Failed to fetch token info", { tokenAddress, error: (error as Error).message });
    return null;
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

  // Try networks in order of popularity
  const networks: NetworkKey[] = [
    "ethereum", 
    "bsc",      // BNB Smart Chain
    "polygon", 
    "arbitrum", 
    "base",
    "optimism",
    "avalanche",
    "fantom"
  ];
  
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


