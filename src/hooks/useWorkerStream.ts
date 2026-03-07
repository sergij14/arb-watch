import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ConnectionStatus,
  Exchange,
  PriceTick,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
} from '@/types/market'

// ─── Public interface ─────────────────────────────────────────────────────────

/** Per-pair price data keyed by exchange */
export type TickMap = Record<string, Partial<Record<Exchange, PriceTick>>>

export interface WorkerStreamState {
  /** Latest tick for each pair, indexed by pair → exchange */
  ticks: TickMap
  /** True when at least one exchange reports "connected" */
  connected: boolean
  /** Latest error message from any exchange */
  error: string | null
  /** Connection status per exchange */
  exchangeStatus: Partial<Record<Exchange, ConnectionStatus>>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Connects to the `priceWorker` SharedWorker and exposes a live tick map,
 * connection status, and error state.
 *
 * The SharedWorker batches messages every 16 ms so this hook updates the
 * React state at most once per animation frame, keeping the UI at 60 fps.
 *
 * @param pairs - Normalized pairs to subscribe to, e.g. ["BTC/USDT", "ETH/USDT"]
 */
export function useWorkerStream(pairs: string[]): WorkerStreamState {
  const workerRef = useRef<SharedWorker | null>(null)
  const pairsRef  = useRef(pairs)

  const [ticks,          setTicks]          = useState<TickMap>({})
  const [connected,      setConnected]      = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [exchangeStatus, setExchangeStatus] = useState<Partial<Record<Exchange, ConnectionStatus>>>({})

  const handleMessage = useCallback((evt: MessageEvent<WorkerOutgoingMessage>) => {
    const msg = evt.data

    switch (msg.type) {
      case 'PRICE_BATCH': {
        setTicks((prev) => {
          const next = { ...prev }
          for (const tick of msg.updates) {
            next[tick.pair] = { ...next[tick.pair], [tick.exchange]: tick }
          }
          return next
        })
        break
      }

      case 'CONNECTION_STATUS': {
        setExchangeStatus((prev) => ({ ...prev, [msg.exchange]: msg.status }))
        setConnected(msg.status === 'connected')
        break
      }

      case 'ERROR': {
        setError(msg.message)
        break
      }
    }
  }, [])

  useEffect(() => {
    // SharedWorker is not available in SSR
    if (typeof window === 'undefined') return

    const worker = new SharedWorker(
      new URL('../lib/worker/priceWorker.ts', import.meta.url),
      { type: 'module', name: 'crypto-price-worker' },
    )

    workerRef.current = worker
    worker.port.addEventListener('message', handleMessage)
    worker.port.start()

    const subscribeMsg: WorkerIncomingMessage = {
      type: 'SUBSCRIBE',
      pairs: pairsRef.current,
    }
    worker.port.postMessage(subscribeMsg)

    return () => {
      const unsubMsg: WorkerIncomingMessage = {
        type: 'UNSUBSCRIBE',
        pairs: pairsRef.current,
      }
      worker.port.postMessage(unsubMsg)
      worker.port.removeEventListener('message', handleMessage)
    }
  }, [handleMessage])

  return { ticks, connected, error, exchangeStatus }
}
