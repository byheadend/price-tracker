import { CronJob } from 'cron';
import { config } from '../config';
import { getActiveProducts, recordPrice, startSession, completeSession } from '../database/queries';
import { GenericScraper } from '../scrapers/generic';
import { analyzePriceChange, PriceChange } from '../analyzer/diff';
import { formatPriceAlert, formatDailySummary, sendTelegramMessage } from '../telegram/notifications';
import { randomDelay } from '../utils/anti-detection';
import { logger } from '../utils/logger';

const scraper = new GenericScraper();

/**
 * Runs a full price check cycle across all tracked products.
 */
async function runPriceCheck(): Promise<void> {
  const products = getActiveProducts();
  if (products.length === 0) {
    logger.info('No active products to check');
    return;
  }

  logger.info(`Starting price check cycle for ${products.length} products`);
  const sessionId = startSession();

  let checked = 0;
  let errors = 0;
  const significantChanges: PriceChange[] = [];

  // Process products with concurrency limit
  const concurrency = config.monitoring.maxConcurrentScrapes;

  for (let i = 0; i < products.length; i += concurrency) {
    const batch = products.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (product) => {
        try {
          const scraped = await scraper.scrape(product.url);

          // Record the new price
          recordPrice(product.id, scraped.price, scraped.currency, scraped.inStock);

          // Analyze the change
          const change = analyzePriceChange(product, scraped.price);
          if (change.isSignificant) {
            significantChanges.push(change);

            // Send immediate alert for significant changes
            const message = formatPriceAlert(change);
            await sendTelegramMessage(
              config.telegram.botToken,
              config.telegram.chatId,
              message
            );
          }

          checked++;
          logger.debug('Product checked', {
            id: product.id,
            price: scraped.price,
            change: change.percentChange,
          });
        } catch (error) {
          errors++;
          logger.error('Failed to check product', {
            productId: product.id,
            error: (error as Error).message,
          });
        }
      })
    );

    // Add delay between batches to avoid detection
    if (i + concurrency < products.length) {
      await randomDelay(3000, 8000);
    }
  }

  completeSession(sessionId, checked, errors);
  logger.info('Price check cycle completed', { checked, errors, changes: significantChanges.length });
}

/**
 * Sends daily summary report via Telegram.
 */
async function sendDailyReport(): Promise<void> {
  const products = getActiveProducts();
  // Simplified — in production, would aggregate from session data
  const message = formatDailySummary(products.length, [], 0);
  await sendTelegramMessage(config.telegram.botToken, config.telegram.chatId, message);
  logger.info('Daily report sent');
}

/**
 * Initializes all scheduled jobs.
 */
export function initScheduler(): void {
  // Price check — every hour between 7am and 11pm
  const priceCheckJob = new CronJob(
    '0 */1 7-23 * * *',
    runPriceCheck,
    null,
    false,
    'Europe/Istanbul'
  );

  // Daily summary — every day at 9pm
  const dailyReportJob = new CronJob(
    '0 0 21 * * *',
    sendDailyReport,
    null,
    false,
    'Europe/Istanbul'
  );

  priceCheckJob.start();
  dailyReportJob.start();

  logger.info('Scheduler initialized', {
    jobs: ['priceCheck (hourly 7-23)', 'dailyReport (21:00)'],
  });
}

// Export for manual trigger
export { runPriceCheck, sendDailyReport };
