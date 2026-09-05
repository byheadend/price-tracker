import { PriceChange } from '../analyzer/diff';
import { getPriceStats, Product } from '../database/queries';
import { logger } from '../utils/logger';

/**
 * Formats a price change into a Telegram notification message.
 */
export function formatPriceAlert(change: PriceChange): string {
  const emoji = change.direction === 'down' ? '📉' : '📈';
  const priceEmoji = change.direction === 'down' ? '💚' : '🔴';
  const arrow = change.direction === 'down' ? '↓' : '↑';

  const stats = getPriceStats(change.product.id, 30);

  let message = `${emoji} *PRICE ${change.direction.toUpperCase()} ALERT*\n\n`;
  message += `📦 *${escapeMarkdown(change.product.name)}*\n`;
  message += `🏪 Platform: ${change.product.platform}\n\n`;
  message += `💰 Old Price: $${change.oldPrice.toFixed(2)}\n`;
  message += `${priceEmoji} New Price: *$${change.newPrice.toFixed(2)}*\n`;
  message += `${arrow} Change: ${change.percentChange > 0 ? '+' : ''}${change.percentChange.toFixed(1)}%`;
  message += ` ($${change.absoluteChange > 0 ? '+' : ''}${change.absoluteChange.toFixed(2)})\n`;

  if (stats) {
    message += `\n📊 *30-Day Stats:*\n`;
    message += `   Low: $${stats.min.toFixed(2)}\n`;
    message += `   High: $${stats.max.toFixed(2)}\n`;
    message += `   Avg: $${stats.avg.toFixed(2)}\n`;
  }

  message += `\n🔗 [View Product](${change.product.url})`;

  return message;
}

/**
 * Formats a stock change notification.
 */
export function formatStockAlert(
  product: Product,
  type: 'back_in_stock' | 'out_of_stock'
): string {
  if (type === 'back_in_stock') {
    return (
      `🟢 *BACK IN STOCK*\n\n` +
      `📦 *${escapeMarkdown(product.name)}*\n` +
      `🏪 Platform: ${product.platform}\n\n` +
      `This product is available again!\n` +
      `🔗 [View Product](${product.url})`
    );
  }

  return (
    `🔴 *OUT OF STOCK*\n\n` +
    `📦 *${escapeMarkdown(product.name)}*\n` +
    `🏪 Platform: ${product.platform}\n\n` +
    `This product is no longer available.\n` +
    `🔗 [View Product](${product.url})`
  );
}

/**
 * Formats a daily summary report.
 */
export function formatDailySummary(
  productsChecked: number,
  priceChanges: PriceChange[],
  errors: number
): string {
  const drops = priceChanges.filter((c) => c.direction === 'down');
  const increases = priceChanges.filter((c) => c.direction === 'up');

  let message = `📊 *DAILY PRICE REPORT*\n`;
  message += `📅 ${new Date().toISOString().split('T')[0]}\n\n`;
  message += `🔍 Products checked: ${productsChecked}\n`;
  message += `📉 Price drops: ${drops.length}\n`;
  message += `📈 Price increases: ${increases.length}\n`;
  message += `❌ Errors: ${errors}\n`;

  if (drops.length > 0) {
    message += `\n🏆 *Biggest Drops:*\n`;
    const topDrops = drops
      .sort((a, b) => a.percentChange - b.percentChange)
      .slice(0, 5);

    for (const drop of topDrops) {
      message += `  • ${escapeMarkdown(drop.product.name.substring(0, 40))}`;
      message += ` — ${drop.percentChange.toFixed(1)}%\n`;
    }
  }

  return message;
}

/**
 * Formats system status message.
 */
export function formatStatus(
  activeProducts: number,
  lastCheck: Date | null,
  uptime: number
): string {
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);

  return (
    `⚙️ *System Status*\n\n` +
    `📦 Active products: ${activeProducts}\n` +
    `🕐 Last check: ${lastCheck ? lastCheck.toISOString() : 'Never'}\n` +
    `⏱ Uptime: ${uptimeHours}h ${uptimeMinutes}m\n` +
    `✅ Status: Running`
  );
}

/**
 * Escape special Markdown characters for Telegram.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/**
 * Sends a Telegram message via the bot.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    logger.info('Telegram message sent', { chatId });
  } catch (error) {
    logger.error('Failed to send Telegram message', {
      error: (error as Error).message,
    });
    throw error;
  }
}
