import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  database: {
    path: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
  monitoring: {
    checkIntervalMs: number;
    maxConcurrentScrapes: number;
    requestTimeoutMs: number;
  };
  antiDetection: {
    minDelayMs: number;
    maxDelayMs: number;
    userAgent: string;
  };
  logging: {
    level: string;
    file: string;
  };
}

export function loadConfig(): Config {
  return {
    database: {
      path: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'tracker.db'),
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
    },
    monitoring: {
      checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS || '3600000', 10),
      maxConcurrentScrapes: parseInt(process.env.MAX_CONCURRENT_SCRAPES || '5', 10),
      requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10),
    },
    antiDetection: {
      minDelayMs: parseInt(process.env.MIN_DELAY_MS || '2000', 10),
      maxDelayMs: parseInt(process.env.MAX_DELAY_MS || '5000', 10),
      userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      file: process.env.LOG_FILE || path.join(__dirname, '..', 'logs', 'tracker.log'),
    },
  };
}

export const config = loadConfig();
