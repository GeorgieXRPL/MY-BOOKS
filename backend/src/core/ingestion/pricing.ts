import axios from "axios";

export class PricingService {
  constructor(private store: any) {}

  async fetchPrice(symbol: string, currency = "USD") {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=${currency}`;
      const res = await axios.get(url, { timeout: 5000 });
      const price = res.data?.[symbol]?.[currency.toLowerCase()];
      if (price) {
        this.store.addPriceTick({
          symbol,
          price,
          currency,
          timestamp: new Date().toISOString(),
          source: "coingecko"
        });
        return price as number;
      }
    } catch {
      // fall through to fallback
    }
    // Fallback static price for offline/dev usage
    const fallback = 1;
    this.store.addPriceTick({
      symbol,
      price: fallback,
      currency,
      timestamp: new Date().toISOString(),
      source: "fallback"
    });
    return fallback;
  }

  async value(symbol: string, amount: number, currency = "USD") {
    const price = await this.fetchPrice(symbol, currency);
    return amount * price;
  }
}

