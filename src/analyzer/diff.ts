import { getLatestPrice, Product } from '../database/queries';

export interface PriceChange {
  product: Product;
  oldPrice: number;
  newPrice: number;
  absoluteChange: number;
  percentChange: number;
  direction: 'up' | 'down' | 'unchanged';
  isSignificant: boolean;
}

/**
 * Compares a new price with the last recorded price for a product.
 * Returns detailed change information for alert generation.
 */
export function analyzePriceChange(
  product: Product,
  newPrice: number,
  significantThresholdPct: number = 1.0
): PriceChange {
  const lastRecord = getLatestPrice(product.id);
  const oldPrice = lastRecord?.price ?? newPrice;

  const absoluteChange = newPrice - oldPrice;
  const percentChange = oldPrice > 0
    ? ((newPrice - oldPrice) / oldPrice) * 100
    : 0;

  const direction: PriceChange['direction'] =
    absoluteChange > 0 ? 'up' :
    absoluteChange < 0 ? 'down' :
    'unchanged';

  return {
    product,
    oldPrice,
    newPrice,
    absoluteChange: Math.round(absoluteChange * 100) / 100,
    percentChange: Math.round(percentChange * 100) / 100,
    direction,
    isSignificant: Math.abs(percentChange) >= significantThresholdPct,
  };
}

/**
 * Detects if a product has gone out of stock.
 */
export function detectStockChange(
  wasInStock: boolean,
  isNowInStock: boolean
): 'back_in_stock' | 'out_of_stock' | null {
  if (!wasInStock && isNowInStock) return 'back_in_stock';
  if (wasInStock && !isNowInStock) return 'out_of_stock';
  return null;
}

/**
 * Calculates simple moving average for trend detection.
 */
export function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(0, period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

/**
 * Detects if a price is at its lowest in a given period.
 */
export function isAllTimeLow(currentPrice: number, historicalPrices: number[]): boolean {
  if (historicalPrices.length === 0) return false;
  return currentPrice <= Math.min(...historicalPrices);
}
