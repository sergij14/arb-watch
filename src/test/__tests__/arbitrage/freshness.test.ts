import { describe, it, expect } from 'vitest'
import { STALE_AFTER_MS, freshTicks, isStale } from '@/lib/arbitrage/freshness'
import type { PriceTick } from '@/types/market'

const NOW = 1_700_000_000_000

function tick(exchange: PriceTick['exchange'], ageMs: number): PriceTick {
  return { exchange, pair: 'BTC/USDT', bid: 100, ask: 101, timestamp: NOW - ageMs }
}

describe('isStale', () => {
  it('treats a recent quote from a connected exchange as fresh', () => {
    expect(isStale(tick('binance', 200), NOW, 'connected')).toBe(false)
  })

  it('treats a quote exactly at the threshold as fresh', () => {
    expect(isStale(tick('binance', STALE_AFTER_MS), NOW, 'connected')).toBe(false)
  })

  it('treats a quote older than the threshold as stale', () => {
    expect(isStale(tick('binance', STALE_AFTER_MS + 1), NOW, 'connected')).toBe(true)
  })

  it('treats any quote from a reconnecting exchange as stale', () => {
    expect(isStale(tick('kraken', 0), NOW, 'reconnecting')).toBe(true)
  })

  it('treats any quote from a disconnected exchange as stale', () => {
    expect(isStale(tick('kraken', 0), NOW, 'disconnected')).toBe(true)
  })

  it('treats a quote from an exchange with no reported status as stale', () => {
    expect(isStale(tick('kraken', 0), NOW, undefined)).toBe(true)
  })
})

describe('freshTicks', () => {
  it('keeps only fresh quotes from connected exchanges', () => {
    const ticks = {
      binance:  tick('binance', 100),
      kraken:   tick('kraken', STALE_AFTER_MS + 500),
      okx:      tick('okx', 100),
      coinbase: tick('coinbase', 100),
    }
    const status = {
      binance:  'connected',
      kraken:   'connected',
      okx:      'reconnecting',
      coinbase: 'connected',
    } as const

    const fresh = freshTicks(ticks, NOW, status)

    expect(fresh.map((t) => t.exchange)).toEqual(['binance', 'coinbase'])
  })

  it('returns an empty array when there are no quotes', () => {
    expect(freshTicks(undefined, NOW, {})).toEqual([])
  })
})
