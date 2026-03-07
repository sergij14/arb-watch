import type { BinanceBookTicker, PriceTick } from '@/types/market'

// Known quote asset suffixes, ordered longest-first to match greedily
const QUOTE_ASSETS = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'BNB', 'USD']

/**
 * Converts a Binance raw symbol like "BTCUSDT" → "BTC/USDT".
 * Tries each known quote suffix from longest to shortest.
 */
export function normalizePair(rawSymbol: string): string {
  const upper = rawSymbol.toUpperCase()
  for (const quote of QUOTE_ASSETS) {
    if (upper.endsWith(quote)) {
      const base = upper.slice(0, upper.length - quote.length)
      return `${base}/${quote}`
    }
  }
  // Fallback: return as-is with a slash in the middle
  const mid = Math.floor(upper.length / 2)
  return `${upper.slice(0, mid)}/${upper.slice(mid)}`
}

/**
 * Normalizes a raw Binance bookTicker WebSocket message into a {@link PriceTick}.
 */
export function normalizeBinanceTick(raw: BinanceBookTicker): PriceTick {
  return {
    exchange: 'binance',
    pair: normalizePair(raw.s),
    bid: parseFloat(raw.b),
    ask: parseFloat(raw.a),
    timestamp: Date.now(),
  }
}
