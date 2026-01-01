/**
 * Auto-Ingest Service
 * Orchestrates blockchain transaction fetching, pricing, and journal creation
 */

import { detectChain, normalizeHash } from "./detector";
import { BlockchainTx, Chain, FetcherResult, CHAIN_CONFIGS } from "./types";
import { fetchEVMTransaction } from "./fetchers/evm";
import { fetchXRPLTransaction } from "./fetchers/xrpl";
import { fetchSolanaTransaction, fetchEnhancedTransaction } from "./fetchers/solana";
import { fetchBitcoinTransaction } from "./fetchers/bitcoin";
import { PricingService } from "../ingestion/pricing";
import { LedgerService } from "../ledger";
import { JournalLine, NormalizedTxn } from "../types";
import { newId } from "../../utils/id";
import { logger } from "../../utils/logger";

export interface AutoIngestResult {
  success: boolean;
  chain?: Chain;
  tx?: BlockchainTx;
  priceUsd?: number;
  valueUsd?: number;
  journalId?: string;
  error?: string;
}

export interface AutoIngestOptions {
  orgId: string;
  actorId: string;
  period: string;
  walletId?: string;
  direction?: "inflow" | "outflow" | "auto";
  createJournal?: boolean;
}

export class AutoIngestService {
  constructor(
    private store: any,
    private pricing: PricingService,
    private ledger: LedgerService
  ) {}

  /**
   * Main entry point: fetch and optionally create journal for a blockchain TX
   */
  async ingestTransaction(txHash: string, options: AutoIngestOptions): Promise<AutoIngestResult> {
    // Step 1: Detect chain
    const chain = detectChain(txHash);
    if (!chain) {
      return { success: false, error: "Unable to detect blockchain from transaction hash format" };
    }

    logger.info(`Detected chain: ${chain}`, { txHash });

    // Step 2: Normalize hash
    const normalizedHash = normalizeHash(txHash, chain);

    // Step 3: Fetch transaction
    const fetchResult = await this.fetchTransaction(normalizedHash, chain);
    if (!fetchResult.success || !fetchResult.tx) {
      return { success: false, chain, error: fetchResult.error || "Failed to fetch transaction" };
    }

    const tx = fetchResult.tx;
    logger.info(`Fetched ${chain} transaction`, { 
      txHash: tx.txHash, 
      value: tx.valueDecimal, 
      symbol: tx.tokenSymbol 
    });

    // Step 4: Get price
    let priceUsd: number | undefined;
    let valueUsd: number | undefined;

    try {
      priceUsd = await this.pricing.value(tx.tokenSymbol, 1, "USD");
      valueUsd = tx.valueDecimal * (priceUsd || 0);
      tx.priceUsd = priceUsd;
      tx.valueUsd = valueUsd;

      if (tx.fee && priceUsd) {
        tx.feeUsd = tx.fee * priceUsd;
      }
    } catch (error) {
      logger.warn("Failed to get price", { symbol: tx.tokenSymbol, error });
      // Continue without price - user can add manually
    }

    // Step 5: Create journal entry if requested
    let journalId: string | undefined;
    if (options.createJournal) {
      journalId = await this.createJournalEntry(tx, options);
    }

    return {
      success: true,
      chain,
      tx,
      priceUsd,
      valueUsd,
      journalId
    };
  }

  /**
   * Fetch transaction from appropriate chain
   */
  private async fetchTransaction(txHash: string, chain: Chain): Promise<FetcherResult> {
    switch (chain) {
      case "evm":
        return fetchEVMTransaction(txHash);
      case "xrpl":
        return fetchXRPLTransaction(txHash);
      case "solana":
        return fetchEnhancedTransaction(txHash);
      case "bitcoin":
        return fetchBitcoinTransaction(txHash);
      default:
        return { success: false, error: `Unsupported chain: ${chain}` };
    }
  }

  /**
   * Create a journal entry from blockchain transaction
   */
  private async createJournalEntry(tx: BlockchainTx, options: AutoIngestOptions): Promise<string> {
    const { orgId, actorId, period, walletId, direction: directionOverride } = options;

    // Determine direction
    let direction: "inflow" | "outflow" = "inflow";
    if (directionOverride && directionOverride !== "auto") {
      direction = directionOverride;
    } else {
      // Auto-detect based on wallet address (if we know our wallets)
      // For now, assume user will specify or we default to inflow
      direction = "inflow";
    }

    // Get account mappings
    const accounts = await Promise.resolve(this.store.listAccounts(orgId));
    const findAccount = (namePart: string) => 
      accounts.find((a: any) => a.name.toLowerCase().includes(namePart.toLowerCase()));

    const treasuryAccount = findAccount("Crypto Assets - Treasury") || findAccount("Crypto Assets");
    const revenueAccount = findAccount("Revenue");
    const expenseAccount = findAccount("Operating Expenses");
    const gasAccount = findAccount("Gas/Network Fees") || expenseAccount;

    if (!treasuryAccount) {
      throw new Error("Required crypto asset account not found in Chart of Accounts");
    }

    const usdValue = tx.valueUsd || 0;
    const lines: JournalLine[] = [];
    const chainConfig = CHAIN_CONFIGS[tx.chain];

    if (direction === "inflow") {
      // Debit asset, credit revenue
      lines.push({
        id: newId(),
        accountId: treasuryAccount.id,
        debit: usdValue,
        credit: 0,
        currency: "USD",
        description: `${chainConfig.name} inflow: ${tx.valueDecimal.toFixed(6)} ${tx.tokenSymbol}`,
        walletId,
        tokenSymbol: tx.tokenSymbol,
        txHash: tx.txHash,
        externalRef: tx.txHash
      });
      
      if (revenueAccount) {
        lines.push({
          id: newId(),
          accountId: revenueAccount.id,
          debit: 0,
          credit: usdValue,
          currency: "USD",
          description: "Recognize crypto inflow",
          walletId,
          tokenSymbol: tx.tokenSymbol,
          txHash: tx.txHash,
          externalRef: tx.txHash
        });
      }
    } else {
      // Debit expense, credit asset
      lines.push({
        id: newId(),
        accountId: expenseAccount?.id || treasuryAccount.id,
        debit: usdValue,
        credit: 0,
        currency: "USD",
        description: `${chainConfig.name} outflow: ${tx.valueDecimal.toFixed(6)} ${tx.tokenSymbol}`,
        walletId,
        tokenSymbol: tx.tokenSymbol,
        txHash: tx.txHash,
        externalRef: tx.txHash
      });
      
      lines.push({
        id: newId(),
        accountId: treasuryAccount.id,
        debit: 0,
        credit: usdValue,
        currency: "USD",
        description: "Reduce crypto asset",
        walletId,
        tokenSymbol: tx.tokenSymbol,
        txHash: tx.txHash,
        externalRef: tx.txHash
      });
    }

    // Add gas/fee entry if present
    if (tx.feeUsd && tx.feeUsd > 0 && gasAccount) {
      lines.push({
        id: newId(),
        accountId: gasAccount.id,
        debit: tx.feeUsd,
        credit: 0,
        currency: "USD",
        description: `${chainConfig.name} network fee`,
        walletId,
        txHash: tx.txHash,
        externalRef: tx.txHash
      });
      
      lines.push({
        id: newId(),
        accountId: treasuryAccount.id,
        debit: 0,
        credit: tx.feeUsd,
        currency: "USD",
        description: "Pay network fee",
        walletId,
        txHash: tx.txHash,
        externalRef: tx.txHash
      });
    }

    // Create the journal entry
    const journal = await this.ledger.createDraft({
      orgId,
      period,
      lines,
      memo: `Auto-ingested ${chainConfig.name} TX: ${tx.txHash.slice(0, 16)}...`,
      createdBy: actorId,
      externalRef: tx.txHash
    });

    logger.info("Created journal entry from blockchain TX", { 
      journalId: journal.id, 
      txHash: tx.txHash, 
      chain: tx.chain 
    });

    return journal.id;
  }

  /**
   * Lookup transaction without creating journal (preview mode)
   */
  async lookupTransaction(txHash: string): Promise<AutoIngestResult> {
    return this.ingestTransaction(txHash, {
      orgId: "preview",
      actorId: "system",
      period: new Date().toISOString().slice(0, 7),
      createJournal: false
    });
  }

  /**
   * Check if a transaction has already been ingested
   */
  async isAlreadyIngested(orgId: string, txHash: string): Promise<boolean> {
    const journals = await Promise.resolve(this.store.listJournals(orgId));
    return journals.some((j: any) => j.externalRef === txHash);
  }
}


