import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../utils/logger';

let db: Database.Database;

/**
 * Initializes the SQLite database and creates all required tables.
 */
export function initDatabase(): Database.Database {
  const dbDir = path.dirname(config.database.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.database.path);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  logger.info('Database initialized', { path: config.database.path });

  return db;
}

function createTables(): void {
  db.exec(`
    -- Products being tracked
    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      url           TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      platform      TEXT NOT NULL,
      category      TEXT,
      image_url     TEXT,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Price history records
    CREATE TABLE IF NOT EXISTS price_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id    INTEGER NOT NULL,
      price         REAL NOT NULL,
      currency      TEXT NOT NULL DEFAULT 'USD',
      in_stock      INTEGER NOT NULL DEFAULT 1,
      scraped_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Price alerts that have been sent
    CREATE TABLE IF NOT EXISTS alerts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id    INTEGER NOT NULL,
      alert_type    TEXT NOT NULL,
      old_price     REAL,
      new_price     REAL,
      change_pct    REAL,
      message       TEXT NOT NULL,
      sent_at       TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Scraping sessions for monitoring health
    CREATE TABLE IF NOT EXISTS scrape_sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at    TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at  TEXT,
      products_checked  INTEGER DEFAULT 0,
      errors_count      INTEGER DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'running'
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_price_history_product 
      ON price_history(product_id, scraped_at DESC);
    CREATE INDEX IF NOT EXISTS idx_products_platform 
      ON products(platform);
    CREATE INDEX IF NOT EXISTS idx_products_active 
      ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_alerts_product 
      ON alerts(product_id, sent_at DESC);
  `);
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    logger.info('Database connection closed');
  }
}

// Run directly to initialize database
if (require.main === module) {
  initDatabase();
  logger.info('Database tables created successfully');
  closeDatabase();
}
