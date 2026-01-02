import axios from "axios";
import { IStore } from "../store.interface";
import { logger } from "../../utils/logger";

// Map common symbols to CoinGecko IDs
// CoinGecko API requires the coin ID, not the symbol
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  // Major cryptocurrencies
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  SOL: "solana",
  BNB: "binancecoin",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  FTM: "fantom",
  ATOM: "cosmos",
  DOT: "polkadot",
  ADA: "cardano",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  
  // Stablecoins
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  BUSD: "binance-usd",
  
  // Wrapped tokens
  WETH: "weth",
  WBTC: "wrapped-bitcoin",
  
  // Layer 2 / Other
  ARB: "arbitrum",
  OP: "optimism",
  
  // Popular meme coins & others
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  BONK: "bonk",
  JUP: "jupiter-exchange-solana",
  RAY: "raydium",
  ORCA: "orca",
  
  // Staked tokens
  MSOL: "msol",
  STSOL: "lido-staked-sol",
  STETH: "staked-ether"
};

export class PricingService {
  constructor(private store: IStore) {}

  /**
   * Convert token symbol to CoinGecko ID
   */
  private symbolToId(symbol: string): string {
    const normalized = symbol.toUpperCase();
    return SYMBOL_TO_COINGECKO_ID[normalized] || symbol.toLowerCase();
  }

  async fetchPrice(symbol: string, currency = "USD"): Promise<number> {
    const coinId = this.symbolToId(symbol);
    
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency.toLowerCase()}`;
      const res = await axios.get(url, { timeout: 8000 });
      const price = res.data?.[coinId]?.[currency.toLowerCase()];
      
      if (price && typeof price === "number") {
        logger.info(`Fetched price for ${symbol}`, { coinId, price, currency });
        await Promise.resolve(this.store.addPriceTick({
          symbol,
          price,
          currency,
          timestamp: new Date().toISOString(),
          source: "coingecko"
        }));
        return price;
      }
      
      // If no price found with the ID, CoinGecko might not support it
      logger.warn(`No price found for ${symbol} (coinId: ${coinId})`);
    } catch (err: any) {
      logger.warn(`Failed to fetch price for ${symbol}`, { error: err.message });
    }
    
    // Try to get cached price from database
    try {
      const cached = await Promise.resolve(this.store.latestPrice?.(symbol, currency));
      if (cached && cached.price) {
        logger.info(`Using cached price for ${symbol}`, { price: cached.price });
        return cached.price;
      }
    } catch {
      // No cache available
    }
    
    // Return 0 instead of 1 to indicate no price available
    // The user can then input the price manually
    logger.warn(`No price available for ${symbol}, returning 0`);
    await Promise.resolve(this.store.addPriceTick({
      symbol,
      price: 0,
      currency,
      timestamp: new Date().toISOString(),
      source: "unavailable"
    }));
    return 0;
  }

  async value(symbol: string, amount: number, currency = "USD"): Promise<number> {
    const price = await this.fetchPrice(symbol, currency);
    return amount * price;
  }
}

