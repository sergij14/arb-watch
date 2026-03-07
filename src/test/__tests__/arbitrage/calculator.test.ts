import { describe, it, expect } from 'vitest'
import { calculateArbitrage, findBestOpportunity } from '@/lib/arbitrage/calculator'
import type { PriceTick } from '@/types/market'

const binanceTick: PriceTick = {
  exchange: 'binance',
  pair: 'BTC/USDT',
  bid: 29505.0,
  ask: 29506.0,
  timestamp: 1000,
}

const krakenTick: PriceTick = {
  exchange: 'kraken',
  pair: 'BTC/USDT',
  bid: 29520.0,
  ask: 29521.0,
  timestamp: 1001,
}

describe('calculateArbitrage', () => {
  it('identifies the correct buy and sell exchange', () => {
    // Buy on Binance (lower ask 29506), sell on Kraken (higher bid 29520)
    const opp = calculateArbitrage('BTC/USDT', binanceTick, krakenTick)
    expect(opp.buyExchange).toBe('binance')
    expect(opp.sellExchange).toBe('kraken')
  })

  it('uses ask for the buy price', () => {
    const opp = calculateArbitrage('BTC/USDT', binanceTick, krakenTick)
    expect(opp.buyAsk).toBe(29506.0)
  })

  it('uses bid for the sell price', () => {
    const opp = calculateArbitrage('BTC/USDT', binanceTick, krakenTick)
    expect(opp.sellBid).toBe(29520.0)
  })

  it('calculates grossSpreadPct correctly', () => {
    // (29520 - 29506) / 29506 * 100 ≈ 0.04744%
    const opp = calculateArbitrage('BTC/USDT', binanceTick, krakenTick)
    expect(opp.grossSpreadPct).toBeCloseTo(0.04744, 3)
  })

  it('subtracts taker fees from both legs for netSpreadPct', () => {
    // Binance taker: 0.1%, Kraken taker: 0.26% → total round-trip: 0.36%
    // net = grossSpreadPct - 0.36 → should be negative (no profit)
    const opp = calculateArbitrage('BTC/USDT', binanceTick, krakenTick)
    const expectedNet = opp.grossSpreadPct - (0.1 + 0.26)
    expect(opp.netSpreadPct).toBeCloseTo(expectedNet, 4)
  })

  it('calculates netProfitUsd per $1000 notional', () => {
    const opp = calculateArbitrage('BTC/USDT', binanceTick, krakenTick)
    const expected = (opp.netSpreadPct / 100) * 1000
    expect(opp.netProfitUsd).toBeCloseTo(expected, 4)
  })

  it('returns the most recent timestamp of both ticks', () => {
    const opp = calculateArbitrage('BTC/USDT', binanceTick, krakenTick)
    expect(opp.timestamp).toBe(Math.max(binanceTick.timestamp, krakenTick.timestamp))
  })

  it('handles reversed scenario (Kraken cheaper) correctly', () => {
    const cheapKraken: PriceTick = { ...krakenTick, ask: 29490.0, bid: 29489.0 }
    const opp = calculateArbitrage('BTC/USDT', binanceTick, cheapKraken)
    expect(opp.buyExchange).toBe('kraken')
    expect(opp.sellExchange).toBe('binance')
  })
})

describe('findBestOpportunity', () => {
  it('returns null when fewer than 2 ticks are provided for a pair', () => {
    const result = findBestOpportunity([binanceTick])
    expect(result).toBeNull()
  })

  it('returns an opportunity when both exchanges have ticks', () => {
    const result = findBestOpportunity([binanceTick, krakenTick])
    expect(result).not.toBeNull()
    expect(result?.pair).toBe('BTC/USDT')
  })

  it('returns null for an empty ticks array', () => {
    expect(findBestOpportunity([])).toBeNull()
  })

  it('picks the opportunity with the highest netSpreadPct across multiple pairs', () => {
    const ethBinance: PriceTick  = { exchange: 'binance', pair: 'ETH/USDT', bid: 1800, ask: 1801, timestamp: 1000 }
    const ethKraken: PriceTick   = { exchange: 'kraken',  pair: 'ETH/USDT', bid: 1820, ask: 1821, timestamp: 1001 }
    const result = findBestOpportunity([binanceTick, krakenTick, ethBinance, ethKraken])
    // ETH has a ~1.1% gross spread vs BTC's ~0.047%, ETH should win
    expect(result?.pair).toBe('ETH/USDT')
  })
})
