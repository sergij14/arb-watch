import type { KrakenTickerMessage, PriceTick } from '@/types/market'

/**
 * Normalizes a Kraken WebSocket v2 ticker message into an array of
 * {@link PriceTick}s — one per entry in `data`.
 *
 * Handles both `snapshot` (initial batch) and `update` message types.
 *
 * @throws {Error} if the message is not a ticker channel or contains no data.
 */
export function normalizeKrakenTicks(raw: KrakenTickerMessage): PriceTick[] {
  if (raw.channel !== 'ticker') {
    throw new Error(`normalizeKrakenTicks: expected channel "ticker", got "${raw.channel}"`)
  }
  if (!raw.data || raw.data.length === 0) {
    throw new Error('normalizeKrakenTicks: data array is empty')
  }

  const now = Date.now()
  return raw.data.map((entry) => ({
    exchange: 'kraken',
    pair: entry.symbol,
    bid: entry.bid,
    ask: entry.ask,
    timestamp: now,
  }))
}

/**
 * Convenience wrapper returning only the first tick.
 * Used by legacy callers and unit tests.
 */
export function normalizeKrakenTick(raw: KrakenTickerMessage): PriceTick {
  return normalizeKrakenTicks(raw)[0]
}
