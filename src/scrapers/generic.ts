import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { BaseScraper, ScrapedProduct, ScraperOptions } from './base';
import { randomDelay, withRetry } from '../utils/anti-detection';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Generic scraper that works with most e-commerce websites.
 * Uses Playwright for JavaScript-heavy sites and Cheerio for static pages.
 * Employs multiple extraction strategies (JSON-LD, Open Graph, meta tags, DOM).
 */
export class GenericScraper extends BaseScraper {
  readonly platform = 'generic';
  private browser: Browser | null = null;

  canHandle(_url: string): boolean {
    // Generic scraper can attempt any URL
    return true;
  }

  extractProductId(url: string): string | null {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname}`;
    } catch {
      return null;
    }
  }

  async scrape(url: string, options?: ScraperOptions): Promise<ScrapedProduct> {
    return withRetry(
      () => this.performScrape(url, options),
      { maxRetries: options?.retries ?? 2 }
    );
  }

  private async performScrape(url: string, options?: ScraperOptions): Promise<ScrapedProduct> {
    const timeout = options?.timeout ?? config.monitoring.requestTimeoutMs;

    // Add human-like delay before request
    await randomDelay();

    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: config.antiDetection.userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    const page = await context.newPage();

    try {
      // Block unnecessary resources to speed up scraping
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', (route) => route.abort());
      await page.route('**/analytics**', (route) => route.abort());
      await page.route('**/tracking**', (route) => route.abort());

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout,
      });

      // Wait for price elements to render
      await page.waitForTimeout(2000);

      const html = await page.content();
      const result = this.extractProductData(html, url);

      logger.info('Product scraped successfully', {
        platform: this.platform,
        name: result.name,
        price: result.price,
        currency: result.currency,
      });

      return result;
    } catch (error) {
      logger.error('Scraping failed', { url, error: (error as Error).message });
      throw error;
    } finally {
      await context.close();
    }
  }

  /**
   * Multi-strategy product data extraction.
   * Tries JSON-LD → Open Graph → Meta tags → DOM selectors.
   */
  private extractProductData(html: string, url: string): ScrapedProduct {
    const $ = cheerio.load(html);

    // Strategy 1: JSON-LD structured data (most reliable)
    const jsonLd = this.extractFromJsonLd($);
    if (jsonLd) return { ...jsonLd, url };

    // Strategy 2: Open Graph meta tags
    const ogData = this.extractFromOpenGraph($);

    // Strategy 3: Common DOM selectors
    const domData = this.extractFromDOM($);

    // Merge all strategies, preferring more reliable sources
    const name = ogData.name || domData.name || 'Unknown Product';
    const price = domData.price || ogData.price || 0;
    const currency = domData.currency || ogData.currency || 'USD';
    const imageUrl = ogData.imageUrl || domData.imageUrl;

    if (price === 0) {
      logger.warn('Could not extract price', { url });
    }

    return {
      url,
      name,
      price,
      currency,
      inStock: domData.inStock ?? true,
      imageUrl,
    };
  }

  private extractFromJsonLd($: cheerio.CheerioAPI): ScrapedProduct | null {
    try {
      const scripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < scripts.length; i++) {
        const text = $(scripts[i]).html();
        if (!text) continue;

        const data = JSON.parse(text);
        const product = data['@type'] === 'Product' ? data : null;
        if (!product) continue;

        const offer = Array.isArray(product.offers)
          ? product.offers[0]
          : product.offers;

        if (!offer) continue;

        return {
          url: '',
          name: product.name || 'Unknown',
          price: parseFloat(offer.price) || 0,
          currency: offer.priceCurrency || 'USD',
          inStock: offer.availability?.includes('InStock') ?? true,
          imageUrl: Array.isArray(product.image) ? product.image[0] : product.image,
          rating: product.aggregateRating?.ratingValue
            ? parseFloat(product.aggregateRating.ratingValue)
            : undefined,
          reviewCount: product.aggregateRating?.reviewCount
            ? parseInt(product.aggregateRating.reviewCount, 10)
            : undefined,
        };
      }
    } catch {
      // JSON-LD parsing failed, try next strategy
    }
    return null;
  }

  private extractFromOpenGraph($: cheerio.CheerioAPI): Partial<ScrapedProduct> {
    return {
      name: $('meta[property="og:title"]').attr('content') || undefined,
      price: parseFloat($('meta[property="product:price:amount"]').attr('content') || '0') || undefined,
      currency: $('meta[property="product:price:currency"]').attr('content') || undefined,
      imageUrl: $('meta[property="og:image"]').attr('content') || undefined,
    };
  }

  private extractFromDOM($: cheerio.CheerioAPI): Partial<ScrapedProduct> & { inStock?: boolean } {
    // Common price selectors across e-commerce sites
    const priceSelectors = [
      '[data-price]',
      '.price__current',
      '.product-price',
      '.price-current',
      '#priceblock_ourprice',
      '.a-price .a-offscreen',
      '[itemprop="price"]',
      '.product__price',
      '.pdp-price',
    ];

    let price: number | undefined;
    for (const selector of priceSelectors) {
      const el = $(selector).first();
      if (el.length) {
        const raw = el.attr('data-price') || el.attr('content') || el.text();
        const cleaned = raw.replace(/[^0-9.,]/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
          break;
        }
      }
    }

    // Common name selectors
    const nameSelectors = ['h1', '[itemprop="name"]', '.product-title', '.product__title'];
    let name: string | undefined;
    for (const selector of nameSelectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 2 && text.length < 500) {
        name = text;
        break;
      }
    }

    // Stock status
    const outOfStockSignals = [
      '.out-of-stock',
      '.sold-out',
      '[data-availability="outOfStock"]',
    ];
    const inStock = !outOfStockSignals.some((sel) => $(sel).length > 0);

    // Image
    const imageUrl =
      $('[itemprop="image"]').attr('src') ||
      $('.product-image img, .product__image img').first().attr('src') ||
      undefined;

    return { name, price, inStock, imageUrl, currency: undefined };
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });
    }
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
