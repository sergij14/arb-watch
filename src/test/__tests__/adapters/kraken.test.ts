import { describe, it, expect } from 'vitest'
import { normalizeKrakenTick, normalizeKrakenTicks } from '@/lib/adapters/kraken'
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

// ---------------------------------------------------------------------------
// normalizeKrakenTicks — returns ALL entries from a message (snapshot + update)
// ---------------------------------------------------------------------------

const SNAPSHOT_MESSAGE: KrakenTickerMessage = {
  channel: 'ticker',
  type: 'snapshot',
  data: [
    {
      symbol: 'BTC/USDT',
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
    {
      symbol: 'ETH/USDT',
      bid: 1850.0,
      bid_qty: 2.0,
      ask: 1850.5,
      ask_qty: 1.5,
      last: 1850.2,
      volume: 5000.0,
      vwap: 1848.0,
      low: 1830.0,
      high: 1870.0,
      change: 5.0,
      change_pct: 0.27,
    },
    {
      symbol: 'SOL/USDT',
      bid: 22.1,
      bid_qty: 50.0,
      ask: 22.15,
      ask_qty: 40.0,
      last: 22.12,
      volume: 80000.0,
      vwap: 22.0,
      low: 21.5,
      high: 22.5,
      change: 0.2,
      change_pct: 0.91,
    },
  ],
}

describe('normalizeKrakenTicks', () => {
  it('returns one PriceTick per data entry in a snapshot', () => {
    const ticks = normalizeKrakenTicks(SNAPSHOT_MESSAGE)
    expect(ticks).toHaveLength(3)
  })

  it('maps each symbol correctly', () => {
    const ticks = normalizeKrakenTicks(SNAPSHOT_MESSAGE)
    expect(ticks[0].pair).toBe('BTC/USDT')
    expect(ticks[1].pair).toBe('ETH/USDT')
    expect(ticks[2].pair).toBe('SOL/USDT')
  })

  it('every tick has exchange "kraken"', () => {
    const ticks = normalizeKrakenTicks(SNAPSHOT_MESSAGE)
    expect(ticks.every((t) => t.exchange === 'kraken')).toBe(true)
  })

  it('reads bid/ask correctly for each entry', () => {
    const ticks = normalizeKrakenTicks(SNAPSHOT_MESSAGE)
    expect(ticks[1].bid).toBe(1850.0)
    expect(ticks[1].ask).toBe(1850.5)
    expect(ticks[2].bid).toBe(22.1)
    expect(ticks[2].ask).toBe(22.15)
  })

  it('handles a single-item update message the same as normalizeKrakenTick', () => {
    const [single] = normalizeKrakenTicks(BASE_MESSAGE)
    expect(single).toEqual(normalizeKrakenTick(BASE_MESSAGE))
  })

  it('throws if channel is not "ticker"', () => {
    const bad = { ...SNAPSHOT_MESSAGE, channel: 'trade' }
    expect(() => normalizeKrakenTicks(bad)).toThrow()
  })

  it('throws if data array is empty', () => {
    const bad = { ...SNAPSHOT_MESSAGE, data: [] }
    expect(() => normalizeKrakenTicks(bad)).toThrow()
  })
})
