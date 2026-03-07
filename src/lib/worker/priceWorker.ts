/**
 * priceWorker.ts — SharedWorker
 *
 * Responsibilities:
 *  1. Open one WebSocket connection per exchange (shared across all browser tabs).
 *  2. Normalize incoming raw messages using exchange adapters.
 *  3. Batch-flush accumulated PriceTick updates to all connected ports every 16ms
 *     (matching a 60 Hz frame), keeping the UI thread free.
 *  4. Broadcast CONNECTION_STATUS and ERROR events to all ports.
 *
 * This file must be placed in /public or referenced via next/dist bundler
 * since SharedWorker scripts must be served as static assets.
 */

import { normalizeBinanceTick } from '@/lib/adapters/binance'
import { normalizeKrakenTick }  from '@/lib/adapters/kraken'
import type {
  PriceTick,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  BinanceBookTicker,
  KrakenTickerMessage,
  Exchange,
} from '@/types/market'

// ─── Port registry ────────────────────────────────────────────────────────────
const ports = new Set<MessagePort>()

// ─── Tick batch buffer (flushed every 16 ms) ──────────────────────────────────
let tickBuffer: PriceTick[] = []

function broadcast(msg: WorkerOutgoingMessage): void {
  for (const port of ports) {
    port.postMessage(msg)
  }
}

function flushBatch(): void {
  if (tickBuffer.length === 0) return
  broadcast({ type: 'PRICE_BATCH', updates: tickBuffer })
  tickBuffer = []
}

setInterval(flushBatch, 16)

// ─── WebSocket management ─────────────────────────────────────────────────────
const sockets = new Map<Exchange, WebSocket>()
const RECONNECT_DELAY_MS = 3_000

function connectBinance(pairs: string[]): void {
  // bookTicker stream for each pair, e.g. btcusdt@bookTicker
  const streams = pairs
    .map((p) => p.replace('/', '').toLowerCase() + '@bookTicker')
    .join('/')

  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`
  const ws  = new WebSocket(url)

  ws.onopen = () => {
    broadcast({ type: 'CONNECTION_STATUS', exchange: 'binance', status: 'connected' })
  }

  ws.onmessage = (evt) => {
    try {
      const envelope = JSON.parse(evt.data) as { data: BinanceBookTicker }
      tickBuffer.push(normalizeBinanceTick(envelope.data))
    } catch {
      // Malformed frame — silently skip
    }
  }

  ws.onclose = () => {
    broadcast({ type: 'CONNECTION_STATUS', exchange: 'binance', status: 'reconnecting' })
    setTimeout(() => connectBinance(pairs), RECONNECT_DELAY_MS)
  }

  ws.onerror = (evt) => {
    broadcast({ type: 'ERROR', exchange: 'binance', message: (evt as ErrorEvent).message ?? 'Unknown error' })
  }

  sockets.set('binance', ws)
}

function connectKraken(pairs: string[]): void {
  const ws = new WebSocket('wss://ws.kraken.com/v2')

  ws.onopen = () => {
    // Subscribe to ticker channel for each pair
    ws.send(
      JSON.stringify({
        method: 'subscribe',
        params: { channel: 'ticker', symbol: pairs },
      }),
    )
    broadcast({ type: 'CONNECTION_STATUS', exchange: 'kraken', status: 'connected' })
  }

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data) as KrakenTickerMessage
      if (msg.channel === 'ticker' && msg.type === 'update') {
        tickBuffer.push(normalizeKrakenTick(msg))
      }
    } catch {
      // Malformed frame — silently skip
    }
  }

  ws.onclose = () => {
    broadcast({ type: 'CONNECTION_STATUS', exchange: 'kraken', status: 'reconnecting' })
    setTimeout(() => connectKraken(pairs), RECONNECT_DELAY_MS)
  }

  ws.onerror = (evt) => {
    broadcast({ type: 'ERROR', exchange: 'kraken', message: (evt as ErrorEvent).message ?? 'Unknown error' })
  }

  sockets.set('kraken', ws)
}

// ─── SharedWorker entry point ─────────────────────────────────────────────────
// @ts-expect-error — SharedWorkerGlobalScope is not in the default TS lib
self.onconnect = (connectEvent: MessageEvent) => {
  const port = connectEvent.ports[0]
  ports.add(port)

  port.onmessage = (evt: MessageEvent<WorkerIncomingMessage>) => {
    const msg = evt.data

    if (msg.type === 'SUBSCRIBE') {
      const pairs = msg.pairs

      if (!sockets.has('binance')) connectBinance(pairs)
      if (!sockets.has('kraken'))  connectKraken(pairs)
    }

    if (msg.type === 'UNSUBSCRIBE') {
      // Future: close sockets if no ports remain subscribed
    }
  }

  // Clean up when the tab closes
  port.addEventListener('close', () => {
    ports.delete(port)
  })

  port.start()
}
