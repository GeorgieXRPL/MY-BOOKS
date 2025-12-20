/**
 * Blockchain Module
 * Multi-chain transaction fetching and auto-ingestion
 */

export * from "./types";
export * from "./detector";
export { AutoIngestService } from "./autoIngest";
export { fetchEVMTransaction } from "./fetchers/evm";
export { fetchXRPLTransaction } from "./fetchers/xrpl";
export { fetchSolanaTransaction, fetchEnhancedTransaction } from "./fetchers/solana";
export { fetchBitcoinTransaction } from "./fetchers/bitcoin";
