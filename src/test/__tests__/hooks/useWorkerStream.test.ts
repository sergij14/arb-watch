import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkerStream } from '@/hooks/useWorkerStream'
import type { PriceTick, WorkerOutgoingMessage } from '@/types/market'

// ─── Mock SharedWorker ────────────────────────────────────────────────────────
class MockMessagePort extends EventTarget {
  postMessage = vi.fn()
  start = vi.fn()
}

class MockSharedWorker {
  port = new MockMessagePort()
}

const mockWorkerInstance = new MockSharedWorker()

vi.stubGlobal('SharedWorker', vi.fn(function () { return mockWorkerInstance }))

// ─── Helper to fire a message from the worker ─────────────────────────────────
function fireWorkerMessage(data: WorkerOutgoingMessage) {
  const event = new MessageEvent('message', { data })
  mockWorkerInstance.port.dispatchEvent(event)
}

const PAIRS = ['BTC/USDT']

const SAMPLE_TICK: PriceTick = {
  exchange: 'binance',
  pair: 'BTC/USDT',
  bid: 29500,
  ask: 29501,
  timestamp: Date.now(),
}

describe('useWorkerStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a SharedWorker on mount', () => {
    renderHook(() => useWorkerStream(PAIRS))
    expect(SharedWorker).toHaveBeenCalledTimes(1)
  })

  it('calls port.start() to open the MessageChannel', () => {
    renderHook(() => useWorkerStream(PAIRS))
    expect(mockWorkerInstance.port.start).toHaveBeenCalledTimes(1)
  })

  it('sends a SUBSCRIBE message with the provided pairs', () => {
    renderHook(() => useWorkerStream(PAIRS))
    expect(mockWorkerInstance.port.postMessage).toHaveBeenCalledWith({
      type: 'SUBSCRIBE',
      pairs: PAIRS,
    })
  })

  it('starts with an empty ticks map and connected=false', () => {
    const { result } = renderHook(() => useWorkerStream(PAIRS))
    expect(result.current.ticks).toEqual({})
    expect(result.current.connected).toBe(false)
  })

  it('updates ticks when a PRICE_BATCH message arrives', () => {
    const { result } = renderHook(() => useWorkerStream(PAIRS))

    act(() => {
      fireWorkerMessage({ type: 'PRICE_BATCH', updates: [SAMPLE_TICK] })
    })

    expect(result.current.ticks['BTC/USDT']).toBeDefined()
    expect(result.current.ticks['BTC/USDT'].binance?.ask).toBe(29501)
  })

  it('sets connected=true when CONNECTION_STATUS connected fires', () => {
    const { result } = renderHook(() => useWorkerStream(PAIRS))

    act(() => {
      fireWorkerMessage({ type: 'CONNECTION_STATUS', exchange: 'binance', status: 'connected' })
    })

    expect(result.current.connected).toBe(true)
  })

  it('sets connected=false when CONNECTION_STATUS disconnected fires', () => {
    const { result } = renderHook(() => useWorkerStream(PAIRS))

    act(() => {
      fireWorkerMessage({ type: 'CONNECTION_STATUS', exchange: 'binance', status: 'connected' })
    })
    act(() => {
      fireWorkerMessage({ type: 'CONNECTION_STATUS', exchange: 'binance', status: 'disconnected' })
    })

    expect(result.current.connected).toBe(false)
  })

  it('exposes the latest error when an ERROR message arrives', () => {
    const { result } = renderHook(() => useWorkerStream(PAIRS))

    act(() => {
      fireWorkerMessage({ type: 'ERROR', exchange: 'kraken', message: 'WebSocket closed' })
    })

    expect(result.current.error).toBe('WebSocket closed')
  })
})
