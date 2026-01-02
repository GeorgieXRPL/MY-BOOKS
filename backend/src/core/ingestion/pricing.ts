import axios from "axios";
import { IStore } from "../store.interface";
import { logger } from "../../utils/logger";

// Map common symbols to CoinGecko IDs
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
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
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  BUSD: "binance-usd",
  WETH: "weth",
  WBTC: "wrapped-bitcoin",
  ARB: "arbitrum",
  OP: "optimism",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  BONK: "bonk",
  JUP: "jupiter-exchange-solana",
  RAY: "raydium",
  ORCA: "orca",
  MSOL: "msol",
  STSOL: "lido-staked-sol",
  STETH: "staked-ether"
};

// Map symbols to CoinCap IDs (backup API)
const SYMBOL_TO_COINCAP_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "xrp",
  SOL: "solana",
  BNB: "binance-coin",
  AVAX: "avalanche",
  MATIC: "polygon",
  FTM: "fantom",
  ATOM: "cosmos",
  DOT: "polkadot",
  ADA: "cardano",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "multi-collateral-dai",
  DOGE: "dogecoin",
  SHIB: "shiba-inu"
};

export class PricingService {
  constructor(private store: IStore) {}

  private symbolToCoingeckoId(symbol: string): string {
    const normalized = symbol.toUpperCase();
    return SYMBOL_TO_COINGECKO_ID[normalized] || symbol.toLowerCase();
  }

  private symbolToCoinCapId(symbol: string): string {
    const normalized = symbol.toUpperCase();
    return SYMBOL_TO_COINCAP_ID[normalized] || symbol.toLowerCase();
  }

  /**
   * Fetch price from CoinCap API (free, no rate limits)
   */
  private async fetchFromCoinCap(symbol: string): Promise<number | null> {
    const coinId = this.symbolToCoinCapId(symbol);
    try {
      const url = `https://api.coincap.io/v2/assets/${coinId}`;
      const res = await axios.get(url, { timeout: 5000 });
      const price = parseFloat(res.data?.data?.priceUsd);
      if (price && !isNaN(price)) {
        logger.info(`CoinCap price for ${symbol}`, { coinId, price });
        return price;
      }
    } catch (err: any) {
      logger.warn(`CoinCap failed for ${symbol}`, { error: err.message });
    }
    return null;
  }

  /**
   * Fetch price from CoinGecko API
   */
  private async fetchFromCoinGecko(symbol: string, currency: string): Promise<number | null> {
    const coinId = this.symbolToCoingeckoId(symbol);
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency.toLowerCase()}`;
      const res = await axios.get(url, { timeout: 5000 });
      const price = res.data?.[coinId]?.[currency.toLowerCase()];
      if (price && typeof price === "number") {
        logger.info(`CoinGecko price for ${symbol}`, { coinId, price });
        return price;
      }
    } catch (err: any) {
      logger.warn(`CoinGecko failed for ${symbol}`, { error: err.message });
    }
    return null;
  }

  async fetchPrice(symbol: string, currency = "USD"): Promise<number> {
    // Try CoinCap first (more reliable, no rate limits)
    let price = await this.fetchFromCoinCap(symbol);
    
    // Fallback to CoinGecko
    if (!price) {
      price = await this.fetchFromCoinGecko(symbol, currency);
    }

    if (price && price > 0) {
      await Promise.resolve(this.store.addPriceTick({
        symbol,
        price,
        currency,
        timestamp: new Date().toISOString(),
        source: "api"
      }));
      return price;
    }

    // Try cached price
    try {
      const cached = await Promise.resolve(this.store.latestPrice?.(symbol, currency));
      if (cached && cached.price && cached.price > 0) {
        logger.info(`Using cached price for ${symbol}`, { price: cached.price });
        return cached.price;
      }
    } catch {
      // No cache
    }

    logger.warn(`No price available for ${symbol}`);
    return 0;
  }

  async value(symbol: string, amount: number, currency = "USD"): Promise<number> {
    const price = await this.fetchPrice(symbol, currency);
    return amount * price;
  }
}

