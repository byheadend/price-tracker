import { config } from './config';
import { initDatabase, closeDatabase } from './database/init';
import { createBot } from './telegram/bot';
import { initScheduler } from './scheduler/cron';
import { logger } from './utils/logger';

/**
 * Price Tracker — Multi-Marketplace Price Monitoring System
 *
 * Monitors product prices across e-commerce platforms and sends
 * real-time Telegram alerts when prices change significantly.
 *
 * @author Serkan Tastan
 */
async function main(): Promise<void> {
  logger.info('🚀 Price Tracker starting...');

  // Validate configuration
  if (!config.telegram.botToken) {
    logger.error('TELEGRAM_BOT_TOKEN is required. Set it in .env file.');
    process.exit(1);
  }

  // Initialize database
  initDatabase();
  logger.info('✅ Database initialized');

  // Start Telegram bot
  const bot = createBot();
  bot.start();
  logger.info('✅ Telegram bot started');

  // Initialize scheduler
  initScheduler();
  logger.info('✅ Scheduler initialized');

  logger.info('🟢 Price Tracker is running');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    await bot.stop();
    closeDatabase();
    logger.info('👋 Price Tracker stopped');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
  });
}

main().catch((error) => {
  logger.error('Fatal error during startup', { error: error.message });
  process.exit(1);
});
