import { describe, it, expect } from 'vitest'
import { normalizeOkxPair, normalizeOkxTick } from '@/lib/adapters/okx'
import type { OkxTickerMessage } from '@/types/market'

const BASE_MESSAGE: OkxTickerMessage = {
  arg: { channel: 'tickers', instId: 'BTC-USDT' },
  data: [
    {
      instId: 'BTC-USDT',
      bidPx: '29500.1',
      bidSz: '0.5',
      askPx: '29500.2',
      askSz: '1.2',
      ts: '1597026383085',
    },
  ],
}

describe('normalizeOkxPair', () => {
  it('converts a dash-separated instId to the normalized pair (BTC-USDT → BTC/USDT)', () => {
    expect(normalizeOkxPair('BTC-USDT')).toBe('BTC/USDT')
  })
})

describe('normalizeOkxTick', () => {
  it('maps a tickers message to a PriceTick', () => {
    expect(normalizeOkxTick(BASE_MESSAGE)).toEqual({
      exchange: 'okx',
      pair: 'BTC/USDT',
      bid: 29500.1,
      ask: 29500.2,
      timestamp: expect.any(Number),
    })
  })

  it('stamps the local receive time, not the exchange time', () => {
    const before = Date.now()
    const tick = normalizeOkxTick(BASE_MESSAGE)
    const after = Date.now()

    expect(tick?.timestamp).toBeGreaterThanOrEqual(before)
    expect(tick?.timestamp).toBeLessThanOrEqual(after)
  })

  it('returns null when the data array is empty', () => {
    expect(normalizeOkxTick({ ...BASE_MESSAGE, data: [] })).toBeNull()
  })

  it('returns null when a price is not a number', () => {
    const bad = { ...BASE_MESSAGE, data: [{ ...BASE_MESSAGE.data[0], bidPx: '' }] }
    expect(normalizeOkxTick(bad)).toBeNull()
  })
})
