/**
 * Chain Detector
 * Detects which blockchain a transaction hash belongs to based on format
 */

import { Chain } from "./types";

/**
 * Detect blockchain chain from transaction hash format
 * 
 * Hash format patterns:
 * - EVM (Ethereum, Polygon, etc.): 0x + 64 hex chars
 * - XRPL: 64 uppercase hex chars (no 0x prefix)
 * - Solana: 87-88 base58 chars (signature format)
 * - Bitcoin: 64 lowercase hex chars (no 0x prefix)
 */
export function detectChain(hash: string): Chain | null {
  const trimmed = hash.trim();

  // EVM: 0x followed by 64 hex characters
  if (/^0x[a-fA-F0-9]{64}$/i.test(trimmed)) {
    return "evm";
  }

  // Solana: 87-88 base58 characters (transaction signature)
  if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(trimmed)) {
    return "solana";
  }

  // XRPL: 64 uppercase hex characters (or mixed case, no 0x)
  // XRPL hashes are typically uppercase
  if (/^[A-F0-9]{64}$/i.test(trimmed) && !trimmed.startsWith("0x")) {
    // Distinguish from Bitcoin by checking if it's all uppercase or mixed
    // XRPL typically uses uppercase, Bitcoin uses lowercase
    if (/[A-F]/.test(trimmed)) {
      return "xrpl";
    }
    // If all lowercase hex, it's likely Bitcoin
    return "bitcoin";
  }

  return null;
}

/**
 * Validate a transaction hash for a specific chain
 */
export function validateHash(hash: string, chain: Chain): boolean {
  const trimmed = hash.trim();

  switch (chain) {
    case "evm":
      return /^0x[a-fA-F0-9]{64}$/i.test(trimmed);
    case "xrpl":
      return /^[A-F0-9]{64}$/i.test(trimmed);
    case "solana":
      return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(trimmed);
    case "bitcoin":
      return /^[a-f0-9]{64}$/i.test(trimmed);
    default:
      return false;
  }
}

/**
 * Normalize a transaction hash to standard format for each chain
 */
export function normalizeHash(hash: string, chain: Chain): string {
  const trimmed = hash.trim();

  switch (chain) {
    case "evm":
      // Ensure lowercase and 0x prefix
      return trimmed.toLowerCase().startsWith("0x") 
        ? trimmed.toLowerCase() 
        : `0x${trimmed.toLowerCase()}`;
    case "xrpl":
      // Uppercase for XRPL
      return trimmed.toUpperCase();
    case "bitcoin":
      // Lowercase for Bitcoin
      return trimmed.toLowerCase();
    case "solana":
      // Base58 is case-sensitive, keep as-is
      return trimmed;
    default:
      return trimmed;
  }
}
