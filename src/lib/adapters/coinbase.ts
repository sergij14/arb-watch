import type { CoinbaseTickerMessage, PriceTick } from '@/types/market'

/**
 * Converts a Coinbase product ID to a normalized pair.
 * - "BTC-USD"  → "BTC/USDT"  (USD treated as USDT-equivalent for comparison)
 * - "BTC-USDT" → "BTC/USDT"
 */
export function normalizeCoinbasePair(productId: string): string {
  return productId
    .replace('-', '/')
    .replace(/\/USD$/, '/USDT')
}

/**
 * Normalizes a raw Coinbase Exchange WebSocket ticker message into a {@link PriceTick}.
 */
export function normalizeCoinbaseTick(raw: CoinbaseTickerMessage): PriceTick {
  return {
    exchange:  'coinbase',
    pair:      normalizeCoinbasePair(raw.product_id),
    bid:       parseFloat(raw.best_bid),
    ask:       parseFloat(raw.best_ask),
    // Local receive time, not `raw.time` (the last trade's time on Coinbase's
    // clock): quote ages are compared across exchanges on one clock.
    timestamp: Date.now(),
  }
}
