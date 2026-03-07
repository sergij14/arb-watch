import type { KrakenTickerMessage, PriceTick } from '@/types/market'

/**
 * Normalizes a Kraken WebSocket v2 ticker message into a {@link PriceTick}.
 *
 * @throws {Error} if the message is not a ticker update or contains no data.
 */
export function normalizeKrakenTick(raw: KrakenTickerMessage): PriceTick {
  if (raw.channel !== 'ticker') {
    throw new Error(`normalizeKrakenTick: expected channel "ticker", got "${raw.channel}"`)
  }
  if (!raw.data || raw.data.length === 0) {
    throw new Error('normalizeKrakenTick: data array is empty')
  }

  const entry = raw.data[0]

  return {
    exchange: 'kraken',
    pair: entry.symbol,   // Kraken already uses "BTC/USD" format
    bid: entry.bid,
    ask: entry.ask,
    timestamp: Date.now(),
  }
}
