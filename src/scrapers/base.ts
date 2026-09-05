/**
 * Base interface for all marketplace scrapers.
 * Each platform-specific scraper implements this contract.
 */
export interface ScrapedProduct {
  url: string;
  name: string;
  price: number;
  currency: string;
  inStock: boolean;
  imageUrl?: string;
  category?: string;
  seller?: string;
  rating?: number;
  reviewCount?: number;
}

export interface ScraperOptions {
  timeout?: number;
  retries?: number;
  proxy?: string;
}

export abstract class BaseScraper {
  abstract readonly platform: string;

  /**
   * Scrapes product data from a given URL.
   * Each platform scraper implements its own extraction logic.
   */
  abstract scrape(url: string, options?: ScraperOptions): Promise<ScrapedProduct>;

  /**
   * Validates whether a URL belongs to this scraper's platform.
   */
  abstract canHandle(url: string): boolean;

  /**
   * Extracts the product ID from a platform URL.
   */
  abstract extractProductId(url: string): string | null;
}
