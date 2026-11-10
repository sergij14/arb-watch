import { describe, it, expect } from 'vitest'
import { normalizeCoinbasePair, normalizeCoinbaseTick } from '@/lib/adapters/coinbase'
import type { CoinbaseTickerMessage } from '@/types/market'

const BASE_MESSAGE: CoinbaseTickerMessage = {
  type: 'ticker',
  product_id: 'BTC-USD',
  best_bid: '29500.10',
  best_ask: '29500.55',
  time: '2020-08-10T02:26:23.085Z',
}

describe('normalizeCoinbasePair', () => {
  it('maps a USD product to the USDT pair it is compared against (BTC-USD → BTC/USDT)', () => {
    expect(normalizeCoinbasePair('BTC-USD')).toBe('BTC/USDT')
  })

  it('leaves a USDT product as USDT (ETH-USDT → ETH/USDT)', () => {
    expect(normalizeCoinbasePair('ETH-USDT')).toBe('ETH/USDT')
  })
})

describe('normalizeCoinbaseTick', () => {
  it('maps a ticker message to a PriceTick', () => {
    expect(normalizeCoinbaseTick(BASE_MESSAGE)).toEqual({
      exchange: 'coinbase',
      pair: 'BTC/USDT',
      bid: 29500.1,
      ask: 29500.55,
      timestamp: expect.any(Number),
    })
  })

  it('stamps the local receive time, not the trade time', () => {
    const before = Date.now()
    const tick = normalizeCoinbaseTick(BASE_MESSAGE)
    const after = Date.now()

    expect(tick.timestamp).toBeGreaterThanOrEqual(before)
    expect(tick.timestamp).toBeLessThanOrEqual(after)
  })
})
