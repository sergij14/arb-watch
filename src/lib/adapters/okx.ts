import type { OkxTickerMessage, PriceTick } from '@/types/market'

/**
 * Converts an OKX instId like "BTC-USDT" → "BTC/USDT".
 */
export function normalizeOkxPair(instId: string): string {
  return instId.replace('-', '/')
}

/**
 * Normalizes a raw OKX WebSocket v5 tickers channel message into a {@link PriceTick}.
 * Returns `null` when the data array is empty or prices are not parseable.
 */
export function normalizeOkxTick(raw: OkxTickerMessage): PriceTick | null {
  const d = raw.data?.[0]
  if (!d) return null

  const bid = parseFloat(d.bidPx)
  const ask = parseFloat(d.askPx)
  if (isNaN(bid) || isNaN(ask)) return null

  return {
    exchange:  'okx',
    pair:      normalizeOkxPair(d.instId),
    bid,
    ask,
    // Local receive time, like every adapter: quote ages are compared across
    // exchanges, so they must all be measured on the same clock.
    timestamp: Date.now(),
  }
}
