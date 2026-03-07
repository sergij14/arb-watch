import { describe, it, expect } from 'vitest'
import { normalizeKrakenTick } from '@/lib/adapters/kraken'
import type { KrakenTickerMessage } from '@/types/market'

const BASE_MESSAGE: KrakenTickerMessage = {
  channel: 'ticker',
  type: 'update',
  data: [
    {
      symbol: 'BTC/USD',
      bid: 29498.5,
      bid_qty: 0.5,
      ask: 29500.0,
      ask_qty: 0.3,
      last: 29499.0,
      volume: 1234.56,
      vwap: 29450.0,
      low: 29000.0,
      high: 30000.0,
      change: 100.0,
      change_pct: 0.34,
    },
  ],
}

describe('normalizeKrakenTick', () => {
  it('preserves the Kraken pair format (BTC/USD)', () => {
    const tick = normalizeKrakenTick(BASE_MESSAGE)
    expect(tick.pair).toBe('BTC/USD')
  })

  it('sets exchange to "kraken"', () => {
    const tick = normalizeKrakenTick(BASE_MESSAGE)
    expect(tick.exchange).toBe('kraken')
  })

  it('reads bid correctly', () => {
    const tick = normalizeKrakenTick(BASE_MESSAGE)
    expect(tick.bid).toBe(29498.5)
  })

  it('reads ask correctly', () => {
    const tick = normalizeKrakenTick(BASE_MESSAGE)
    expect(tick.ask).toBe(29500.0)
  })

  it('sets a timestamp as a number (ms)', () => {
    const before = Date.now()
    const tick = normalizeKrakenTick(BASE_MESSAGE)
    const after = Date.now()
    expect(tick.timestamp).toBeGreaterThanOrEqual(before)
    expect(tick.timestamp).toBeLessThanOrEqual(after)
  })

  it('returns a valid PriceTick shape', () => {
    const tick = normalizeKrakenTick(BASE_MESSAGE)
    expect(tick).toMatchObject({
      exchange: 'kraken',
      pair: expect.any(String),
      bid: expect.any(Number),
      ask: expect.any(Number),
      timestamp: expect.any(Number),
    })
  })

  it('throws if the message channel is not "ticker"', () => {
    const bad = { ...BASE_MESSAGE, channel: 'trade' }
    expect(() => normalizeKrakenTick(bad)).toThrow()
  })

  it('throws if data array is empty', () => {
    const bad = { ...BASE_MESSAGE, data: [] }
    expect(() => normalizeKrakenTick(bad)).toThrow()
  })
})
