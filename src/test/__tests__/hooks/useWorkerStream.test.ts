import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkerStream } from '@/hooks/useWorkerStream'
import type { PriceTick, WorkerOutgoingMessage } from '@/types/market'

// ─── Mock Worker ──────────────────────────────────────────────────────────────
// The hook uses `new Worker(new URL(...))` — we stub the global constructor.
// Our mock extends EventTarget so addEventListener/dispatchEvent work natively.

class MockWorker extends EventTarget {
  postMessage = vi.fn()
  terminate   = vi.fn()
}

let mockWorkerInstance: MockWorker

vi.stubGlobal('Worker', vi.fn(function () {
  mockWorkerInstance = new MockWorker()
  return mockWorkerInstance
}))

// ─── Helper to fire a message from the worker to the hook ────────────────────
function fireWorkerMessage(data: WorkerOutgoingMessage) {
  const event = new MessageEvent('message', { data })
  mockWorkerInstance.dispatchEvent(event)
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

  it('creates a Worker on mount', () => {
    renderHook(() => useWorkerStream(PAIRS))
    expect(Worker).toHaveBeenCalledTimes(1)
  })

  it('sends a SUBSCRIBE message with the provided pairs on mount', () => {
    renderHook(() => useWorkerStream(PAIRS))
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
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

  it('sends UNSUBSCRIBE and terminates the worker on unmount', () => {
    const { unmount } = renderHook(() => useWorkerStream(PAIRS))
    unmount()
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      type: 'UNSUBSCRIBE',
      pairs: PAIRS,
    })
    expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1)
  })
})
