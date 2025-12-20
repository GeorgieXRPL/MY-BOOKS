/**
 * Blockchain Types
 * Unified types for multi-chain transaction handling
 */

export type Chain = "evm" | "xrpl" | "solana" | "bitcoin";

export interface BlockchainTx {
  // Core identifiers
  chain: Chain;
  txHash: string;
  blockNumber?: number;
  blockTime?: string;

  // Transaction details
  from: string;
  to: string;
  value: string; // Raw value in native units
  valueDecimal: number; // Converted to decimal

  // Token info (for token transfers)
  tokenSymbol: string;
  tokenAddress?: string;
  tokenDecimals?: number;

  // Pricing
  priceUsd?: number;
  valueUsd?: number;

  // Fees
  fee?: number;
  feeUsd?: number;

  // Status
  status: "success" | "failed" | "pending";
  
  // Metadata
  memo?: string;
  rawData?: Record<string, unknown>;
}

export interface ChainConfig {
  name: string;
  chain: Chain;
  nativeSymbol: string;
  decimals: number;
  explorerUrl: string;
}

export const CHAIN_CONFIGS: Record<Chain, ChainConfig> = {
  evm: {
    name: "Ethereum/EVM",
    chain: "evm",
    nativeSymbol: "ETH",
    decimals: 18,
    explorerUrl: "https://etherscan.io/tx/"
  },
  xrpl: {
    name: "XRP Ledger",
    chain: "xrpl",
    nativeSymbol: "XRP",
    decimals: 6,
    explorerUrl: "https://xrpscan.com/tx/"
  },
  solana: {
    name: "Solana",
    chain: "solana",
    nativeSymbol: "SOL",
    decimals: 9,
    explorerUrl: "https://solscan.io/tx/"
  },
  bitcoin: {
    name: "Bitcoin",
    chain: "bitcoin",
    nativeSymbol: "BTC",
    decimals: 8,
    explorerUrl: "https://blockstream.info/tx/"
  }
};

export interface FetcherResult {
  success: boolean;
  tx?: BlockchainTx;
  error?: string;
}
