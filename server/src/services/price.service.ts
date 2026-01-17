import axios from 'axios';

interface PriceCache {
  [key: string]: {
    price: number;
    timestamp: number;
  };
}

class PriceService {
  private cache: PriceCache = {};
  private cacheDuration = 30000; // 30 seconds
  private baseUrl = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';

  private coinGeckoIds: { [key: string]: string } = {
    ETH: 'ethereum',
    USDT: 'tether',
    USDC: 'usd-coin',
    SOL: 'solana',
    BNB: 'binancecoin',
    MATIC: 'matic-network',
  };

  /**
   * Get cryptocurrency price in USD
   */
  async getPrice(crypto: string): Promise<number> {
    const cacheKey = `${crypto}_USD`;
    const cached = this.cache[cacheKey];

    // Return cached price if still valid
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.price;
    }

    try {
      const coinId = this.coinGeckoIds[crypto.toUpperCase()];
      if (!coinId) {
        throw new Error(`Unsupported cryptocurrency: ${crypto}`);
      }

      const response = await axios.get(`${this.baseUrl}/simple/price`, {
        params: {
          ids: coinId,
          vs_currencies: 'usd',
        },
      });

      const price = response.data[coinId]?.usd;
      if (!price) {
        throw new Error(`Price not found for ${crypto}`);
      }

      // Cache the price
      this.cache[cacheKey] = {
        price,
        timestamp: Date.now(),
      };

      return price;
    } catch (error) {
      console.error(`Error fetching price for ${crypto}:`, error);
      
      // Return cached price even if expired, or throw
      if (cached) {
        console.warn(`Using expired cache for ${crypto}`);
        return cached.price;
      }
      
      throw new Error(`Failed to fetch price for ${crypto}`);
    }
  }

  /**
   * Convert fiat amount to cryptocurrency amount
   */
  async convertToCrypto(fiatAmount: number, fiatCurrency: string, crypto: string): Promise<number> {
    // For simplicity, assuming fiatCurrency is always USD
    // In production, you'd convert fiat to USD first if needed
    const cryptoPrice = await this.getPrice(crypto);
    return fiatAmount / cryptoPrice;
  }

  /**
   * Convert cryptocurrency amount to fiat
   */
  async convertToFiat(cryptoAmount: number, crypto: string, fiatCurrency: string = 'USD'): Promise<number> {
    const cryptoPrice = await this.getPrice(crypto);
    return cryptoAmount * cryptoPrice;
  }

  /**
   * Get multiple prices at once
   */
  async getPrices(cryptos: string[]): Promise<{ [key: string]: number }> {
    const prices: { [key: string]: number } = {};
    
    await Promise.all(
      cryptos.map(async (crypto) => {
        try {
          prices[crypto] = await this.getPrice(crypto);
        } catch (error) {
          console.error(`Failed to get price for ${crypto}:`, error);
          prices[crypto] = 0;
        }
      })
    );

    return prices;
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.cache = {};
  }
}

export const priceService = new PriceService();
