import { config } from '../config';

/**
 * Generates a random delay between min and max milliseconds.
 * Mimics human browsing behavior to avoid bot detection.
 */
export function randomDelay(
  minMs: number = config.antiDetection.minDelayMs,
  maxMs: number = config.antiDetection.maxDelayMs
): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Adds jitter to a base delay, making timing patterns unpredictable.
 */
export function jitteredDelay(baseMs: number, jitterPercent: number = 0.3): Promise<void> {
  const jitter = baseMs * jitterPercent;
  const delay = baseMs + (Math.random() * 2 * jitter - jitter);
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
}

/**
 * Randomizes the order of an array to vary scraping patterns.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Rate limiter that ensures a minimum interval between operations.
 */
export class RateLimiter {
  private lastCallTime = 0;

  constructor(private readonly minIntervalMs: number) {}

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minIntervalMs - elapsed)
      );
    }
    this.lastCallTime = Date.now();
  }
}

/**
 * Retry wrapper with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jittered = delay + Math.random() * delay * 0.5;
      await new Promise((resolve) => setTimeout(resolve, jittered));
    }
  }

  throw new Error('Unreachable');
}
