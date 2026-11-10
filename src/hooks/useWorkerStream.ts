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
 * Connects to the `priceWorker` Web Worker and exposes a live tick map,
 * connection status, and error state.
 *
 * The Worker batches messages every 16 ms so this hook updates React state
 * at most once per animation frame, keeping the UI at 60 fps.
 *
 * @param pairs - Normalized pairs to subscribe to, e.g. ["BTC/USDT", "ETH/USDT"]
 */
export function useWorkerStream(pairs: string[]): WorkerStreamState {
  const workerRef = useRef<Worker | null>(null)
  const pairsRef  = useRef(pairs)

  const [ticks,          setTicks]          = useState<TickMap>({})
  const [error,          setError]          = useState<string | null>(null)
  const [exchangeStatus, setExchangeStatus] = useState<Partial<Record<Exchange, ConnectionStatus>>>({})

  // Derived, not stored: the feed is live while any exchange is connected. A
  // single flag set by whichever status message came last would report the whole
  // feed down when one of four sockets drops.
  const connected = Object.values(exchangeStatus).some((status) => status === 'connected')

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
        break
      }

      case 'ERROR': {
        setError(msg.message)
        break
      }
    }
  }, [])

  useEffect(() => {
    // Worker is not available in SSR
    if (typeof window === 'undefined') return

    const worker = new Worker(
      new URL('../lib/worker/priceWorker.ts', import.meta.url),
    )

    workerRef.current = worker
    worker.addEventListener('message', handleMessage)

    worker.postMessage({ type: 'SUBSCRIBE', pairs: pairsRef.current } satisfies WorkerIncomingMessage)

    return () => {
      worker.postMessage({ type: 'UNSUBSCRIBE', pairs: pairsRef.current } satisfies WorkerIncomingMessage)
      worker.removeEventListener('message', handleMessage)
      worker.terminate()
    }
  }, [handleMessage])

  return { ticks, connected, error, exchangeStatus }
}
