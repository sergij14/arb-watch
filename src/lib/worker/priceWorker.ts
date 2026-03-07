/**
 * priceWorker.ts — Web Worker (bundled by Next.js webpack via new Worker(new URL(...)))
 *
 * Responsibilities:
 *  1. Open one WebSocket connection per exchange off the main thread.
 *  2. Normalize raw exchange messages using the exchange adapters.
 *  3. Batch-flush accumulated PriceTick updates every 16 ms (60 fps boundary)
 *     so the main UI thread is never blocked by high-frequency tick storms.
 *  4. Post CONNECTION_STATUS and ERROR events back to the main thread.
 *
 * Architecture note: This is a dedicated Web Worker bundled automatically by
 * Next.js via `new Worker(new URL(...))`.
 */

import { normalizeBinanceTick } from '@/lib/adapters/binance'
import { normalizeKrakenTicks } from '@/lib/adapters/kraken'
import type {
  PriceTick,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  BinanceBookTicker,
  KrakenTickerMessage,
  Exchange,
} from '@/types/market'

// ─── Tick batch buffer (flushed every 16 ms) ─────────────────────────────────
let tickBuffer: PriceTick[] = []

function post(msg: WorkerOutgoingMessage): void {
  self.postMessage(msg)
}

function flushBatch(): void {
  if (tickBuffer.length === 0) return
  post({ type: 'PRICE_BATCH', updates: tickBuffer })
  tickBuffer = []
}

setInterval(flushBatch, 16)

// ─── WebSocket management ─────────────────────────────────────────────────────
const sockets = new Map<Exchange, WebSocket>()
const RECONNECT_DELAY_MS = 3_000

function connectBinance(pairs: string[]): void {
  const streams = pairs
    .map((p) => p.replace('/', '').toLowerCase() + '@bookTicker')
    .join('/')

  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`
  const ws  = new WebSocket(url)

  ws.onopen = () => {
    post({ type: 'CONNECTION_STATUS', exchange: 'binance', status: 'connected' })
  }

  ws.onmessage = (evt) => {
    try {
      const envelope = JSON.parse(evt.data as string) as { data: BinanceBookTicker }
      tickBuffer.push(normalizeBinanceTick(envelope.data))
    } catch { /* malformed frame — skip */ }
  }

  ws.onclose = () => {
    post({ type: 'CONNECTION_STATUS', exchange: 'binance', status: 'reconnecting' })
    sockets.delete('binance')
    setTimeout(() => connectBinance(pairs), RECONNECT_DELAY_MS)
  }

  ws.onerror = () => {
    post({ type: 'ERROR', exchange: 'binance', message: 'WebSocket error' })
  }

  sockets.set('binance', ws)
}

function connectKraken(pairs: string[]): void {
  const ws = new WebSocket('wss://ws.kraken.com/v2')

  ws.onopen = () => {
    ws.send(JSON.stringify({
      method: 'subscribe',
      params: { channel: 'ticker', symbol: pairs },
    }))
    post({ type: 'CONNECTION_STATUS', exchange: 'kraken', status: 'connected' })
  }

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data as string) as KrakenTickerMessage
      // Handle both 'snapshot' (initial batch for all subscribed pairs)
      // and 'update' (subsequent per-pair ticks).
      if (msg.channel === 'ticker' && (msg.type === 'update' || msg.type === 'snapshot')) {
        const ticks = normalizeKrakenTicks(msg)
        for (const tick of ticks) tickBuffer.push(tick)
      }
    } catch { /* malformed frame — skip */ }
  }

  ws.onclose = () => {
    post({ type: 'CONNECTION_STATUS', exchange: 'kraken', status: 'reconnecting' })
    sockets.delete('kraken')
    setTimeout(() => connectKraken(pairs), RECONNECT_DELAY_MS)
  }

  ws.onerror = () => {
    post({ type: 'ERROR', exchange: 'kraken', message: 'WebSocket error' })
  }

  sockets.set('kraken', ws)
}

// ─── Worker message handler ───────────────────────────────────────────────────
self.addEventListener('message', (evt: MessageEvent<WorkerIncomingMessage>) => {
  const msg = evt.data

  if (msg.type === 'SUBSCRIBE') {
    if (!sockets.has('binance')) connectBinance(msg.pairs)
    if (!sockets.has('kraken'))  connectKraken(msg.pairs)
  }

  if (msg.type === 'UNSUBSCRIBE') {
    for (const ws of sockets.values()) ws.close()
    sockets.clear()
  }
})
