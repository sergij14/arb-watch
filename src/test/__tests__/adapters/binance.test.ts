import { describe, it, expect } from 'vitest'
import { normalizeBinanceTick } from '@/lib/adapters/binance'
import type { BinanceBookTicker } from '@/types/market'

const BASE_TICK: BinanceBookTicker = {
  u: 400900217,
  s: 'BTCUSDT',
  b: '29500.12000000',
  B: '1.50000000',
  a: '29501.00000000',
  A: '0.80000000',
}

describe('normalizeBinanceTick', () => {
  it('maps symbol to normalized pair format (BTC/USDT)', () => {
    const tick = normalizeBinanceTick(BASE_TICK)
    expect(tick.pair).toBe('BTC/USDT')
  })

  it('maps symbol ending in BTC correctly (ETHBTC → ETH/BTC)', () => {
    const tick = normalizeBinanceTick({ ...BASE_TICK, s: 'ETHBTC' })
    expect(tick.pair).toBe('ETH/BTC')
  })

  it('sets exchange to "binance"', () => {
    const tick = normalizeBinanceTick(BASE_TICK)
    expect(tick.exchange).toBe('binance')
  })

  it('parses bid as a number', () => {
    const tick = normalizeBinanceTick(BASE_TICK)
    expect(tick.bid).toBe(29500.12)
  })

  it('parses ask as a number', () => {
    const tick = normalizeBinanceTick(BASE_TICK)
    expect(tick.ask).toBe(29501.0)
  })

  it('sets a timestamp as a number (ms)', () => {
    const before = Date.now()
    const tick = normalizeBinanceTick(BASE_TICK)
    const after = Date.now()
    expect(tick.timestamp).toBeGreaterThanOrEqual(before)
    expect(tick.timestamp).toBeLessThanOrEqual(after)
  })

  it('returns a valid PriceTick shape', () => {
    const tick = normalizeBinanceTick(BASE_TICK)
    expect(tick).toMatchObject({
      exchange: 'binance',
      pair: expect.any(String),
      bid: expect.any(Number),
      ask: expect.any(Number),
      timestamp: expect.any(Number),
    })
  })

  it('handles USDC quote pairs (BTCUSDC → BTC/USDC)', () => {
    const tick = normalizeBinanceTick({ ...BASE_TICK, s: 'BTCUSDC' })
    expect(tick.pair).toBe('BTC/USDC')
  })
})
