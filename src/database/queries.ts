import { getDatabase } from './init';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────

export interface Product {
  id: number;
  url: string;
  name: string;
  platform: string;
  category: string | null;
  image_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface PriceRecord {
  id: number;
  product_id: number;
  price: number;
  currency: string;
  in_stock: number;
  scraped_at: string;
}

export interface PriceAlert {
  id: number;
  product_id: number;
  alert_type: string;
  old_price: number | null;
  new_price: number | null;
  change_pct: number | null;
  message: string;
  sent_at: string;
}

// ─── Product Queries ─────────────────────────────────────────────────

export function addProduct(
  url: string,
  name: string,
  platform: string,
  category?: string,
  imageUrl?: string
): Product {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO products (url, name, platform, category, image_url)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(url, name, platform, category || null, imageUrl || null);
  logger.info('Product added', { id: result.lastInsertRowid, name, platform });

  return getProductById(Number(result.lastInsertRowid))!;
}

export function getProductById(id: number): Product | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
}

export function getActiveProducts(): Product[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY platform, name').all() as Product[];
}

export function getProductByUrl(url: string): Product | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM products WHERE url = ?').get(url) as Product | undefined;
}

export function deactivateProduct(id: number): void {
  const db = getDatabase();
  db.prepare("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  logger.info('Product deactivated', { id });
}

export function getProductCount(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get() as { count: number };
  return row.count;
}

// ─── Price History Queries ───────────────────────────────────────────

export function recordPrice(
  productId: number,
  price: number,
  currency: string = 'USD',
  inStock: boolean = true
): PriceRecord {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO price_history (product_id, price, currency, in_stock)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(productId, price, currency, inStock ? 1 : 0);
  return db.prepare('SELECT * FROM price_history WHERE id = ?').get(result.lastInsertRowid) as PriceRecord;
}

export function getLatestPrice(productId: number): PriceRecord | undefined {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM price_history 
    WHERE product_id = ? 
    ORDER BY scraped_at DESC 
    LIMIT 1
  `).get(productId) as PriceRecord | undefined;
}

export function getPriceHistory(
  productId: number,
  limit: number = 30
): PriceRecord[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM price_history 
    WHERE product_id = ? 
    ORDER BY scraped_at DESC 
    LIMIT ?
  `).all(productId, limit) as PriceRecord[];
}

export function getPriceStats(productId: number, days: number = 30): {
  min: number;
  max: number;
  avg: number;
  current: number;
  records: number;
} | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT 
      MIN(price) as min,
      MAX(price) as max,
      AVG(price) as avg,
      COUNT(*) as records
    FROM price_history
    WHERE product_id = ?
      AND scraped_at >= datetime('now', '-' || ? || ' days')
  `).get(productId, days) as { min: number; max: number; avg: number; records: number } | undefined;

  if (!row || row.records === 0) return null;

  const latest = getLatestPrice(productId);
  return {
    min: row.min,
    max: row.max,
    avg: Math.round(row.avg * 100) / 100,
    current: latest?.price || 0,
    records: row.records,
  };
}

// ─── Alert Queries ───────────────────────────────────────────────────

export function recordAlert(
  productId: number,
  alertType: string,
  oldPrice: number | null,
  newPrice: number | null,
  changePct: number | null,
  message: string
): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO alerts (product_id, alert_type, old_price, new_price, change_pct, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(productId, alertType, oldPrice, newPrice, changePct, message);
}

export function getRecentAlerts(limit: number = 10): (PriceAlert & { product_name: string })[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT a.*, p.name as product_name
    FROM alerts a
    JOIN products p ON a.product_id = p.id
    ORDER BY a.sent_at DESC
    LIMIT ?
  `).all(limit) as (PriceAlert & { product_name: string })[];
}

// ─── Session Queries ─────────────────────────────────────────────────

export function startSession(): number {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO scrape_sessions DEFAULT VALUES').run();
  return Number(result.lastInsertRowid);
}

export function completeSession(
  sessionId: number,
  productsChecked: number,
  errorsCount: number
): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE scrape_sessions 
    SET completed_at = datetime('now'), 
        products_checked = ?, 
        errors_count = ?, 
        status = 'completed'
    WHERE id = ?
  `).run(productsChecked, errorsCount, sessionId);
}
