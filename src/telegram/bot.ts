import { Bot, Context } from 'grammy';
import { config } from '../config';
import {
  addProduct,
  deactivateProduct,
  getActiveProducts,
  getProductCount,
  getPriceHistory,
  getPriceStats,
  getProductByUrl,
} from '../database/queries';
import { formatStatus } from './notifications';
import { logger } from '../utils/logger';

const startTime = Date.now();

/**
 * Creates and configures the Telegram bot with all command handlers.
 */
export function createBot(): Bot {
  const bot = new Bot(config.telegram.botToken);

  // ─── Command Handlers ──────────────────────────────────────

  bot.command('start', async (ctx: Context) => {
    await ctx.reply(
      `🤖 *Price Tracker Bot*\n\n` +
      `I monitor product prices across e-commerce platforms and ` +
      `alert you when prices change.\n\n` +
      `*Commands:*\n` +
      `/track <url> — Start tracking a product\n` +
      `/untrack <id> — Stop tracking\n` +
      `/list — Show tracked products\n` +
      `/history <id> — Price history\n` +
      `/status — System status\n` +
      `/help — Show this message`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('track', async (ctx: Context) => {
    const url = ctx.message?.text?.split(' ').slice(1).join(' ').trim();
    if (!url) {
      await ctx.reply('❌ Usage: /track <product_url>');
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      await ctx.reply('❌ Invalid URL. Please provide a valid product URL.');
      return;
    }

    // Check if already tracked
    const existing = getProductByUrl(url);
    if (existing) {
      await ctx.reply(`ℹ️ This product is already being tracked (ID: ${existing.id})`);
      return;
    }

    try {
      const product = addProduct(url, 'Loading...', detectPlatform(url));
      await ctx.reply(
        `✅ *Product added for tracking*\n\n` +
        `🆔 ID: ${product.id}\n` +
        `🔗 URL: ${url}\n` +
        `🏪 Platform: ${product.platform}\n\n` +
        `Price data will be collected on the next scan cycle.`,
        { parse_mode: 'Markdown' }
      );
      logger.info('Product tracking started via Telegram', { productId: product.id, url });
    } catch (error) {
      await ctx.reply(`❌ Failed to add product: ${(error as Error).message}`);
    }
  });

  bot.command('untrack', async (ctx: Context) => {
    const idStr = ctx.message?.text?.split(' ')[1];
    if (!idStr) {
      await ctx.reply('❌ Usage: /untrack <product_id>');
      return;
    }

    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      await ctx.reply('❌ Invalid product ID.');
      return;
    }

    deactivateProduct(id);
    await ctx.reply(`✅ Product #${id} removed from tracking.`);
  });

  bot.command('list', async (ctx: Context) => {
    const products = getActiveProducts();
    if (products.length === 0) {
      await ctx.reply('📭 No products are being tracked. Use /track <url> to add one.');
      return;
    }

    let message = `📦 *Tracked Products (${products.length}):*\n\n`;
    for (const product of products.slice(0, 20)) {
      const stats = getPriceStats(product.id, 7);
      const priceStr = stats ? `$${stats.current.toFixed(2)}` : 'Pending...';
      message += `*${product.id}.* ${product.name.substring(0, 45)}\n`;
      message += `   💰 ${priceStr} | 🏪 ${product.platform}\n\n`;
    }

    if (products.length > 20) {
      message += `... and ${products.length - 20} more`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  bot.command('history', async (ctx: Context) => {
    const idStr = ctx.message?.text?.split(' ')[1];
    if (!idStr) {
      await ctx.reply('❌ Usage: /history <product_id>');
      return;
    }

    const id = parseInt(idStr, 10);
    const history = getPriceHistory(id, 10);
    if (history.length === 0) {
      await ctx.reply('📭 No price history found for this product.');
      return;
    }

    const stats = getPriceStats(id, 30);
    let message = `📈 *Price History (Last 10 records):*\n\n`;

    for (const record of history) {
      const date = new Date(record.scraped_at).toLocaleDateString();
      message += `${date}: $${record.price.toFixed(2)} ${record.in_stock ? '✅' : '❌'}\n`;
    }

    if (stats) {
      message += `\n📊 *30-Day Stats:*\n`;
      message += `Min: $${stats.min.toFixed(2)} | Max: $${stats.max.toFixed(2)} | Avg: $${stats.avg.toFixed(2)}`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  bot.command('status', async (ctx: Context) => {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const productCount = getProductCount();
    const message = formatStatus(productCount, new Date(), uptimeSeconds);
    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  bot.command('help', async (ctx: Context) => {
    await ctx.reply(
      `🤖 *Price Tracker Commands:*\n\n` +
      `/track <url> — Add a product to track\n` +
      `/untrack <id> — Remove a product\n` +
      `/list — Show all tracked products\n` +
      `/history <id> — View price history\n` +
      `/status — System health status\n` +
      `/help — This message`,
      { parse_mode: 'Markdown' }
    );
  });

  // Error handler
  bot.catch((err) => {
    logger.error('Bot error', { error: err.message });
  });

  return bot;
}

/**
 * Detects the e-commerce platform from a URL.
 */
function detectPlatform(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();

  const platforms: Record<string, string> = {
    'amazon': 'Amazon',
    'ebay': 'eBay',
    'walmart': 'Walmart',
    'trendyol': 'Trendyol',
    'hepsiburada': 'Hepsiburada',
    'n11': 'N11',
    'aliexpress': 'AliExpress',
    'etsy': 'Etsy',
  };

  for (const [key, name] of Object.entries(platforms)) {
    if (hostname.includes(key)) return name;
  }

  return hostname.replace('www.', '').split('.')[0];
}
