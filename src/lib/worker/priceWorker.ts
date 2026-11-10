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
import { normalizeOkxTick } from '@/lib/adapters/okx'
import { normalizeCoinbaseTick } from '@/lib/adapters/coinbase'
import type {
  PriceTick,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  BinanceBookTicker,
  KrakenTickerMessage,
  OkxTickerMessage,
  CoinbaseTickerMessage,
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
      // By default Kraken only pushes a ticker on a trade, which on USDT pairs can
      // be 20+ s apart while the book moves underneath. 'bbo' pushes on every
      // best bid/offer change instead.
      params: { channel: 'ticker', symbol: pairs, event_trigger: 'bbo' },
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

function connectOkx(pairs: string[]): void {
  // OKX uses dash-separated instIds: "BTC/USDT" → "BTC-USDT"
  const args = pairs.map((p) => ({ channel: 'tickers', instId: p.replace('/', '-') }))
  const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public')

  // OKX requires a pong response to its server-sent ping to keep the connection alive
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  ws.onopen = () => {
    ws.send(JSON.stringify({ op: 'subscribe', args }))
    post({ type: 'CONNECTION_STATUS', exchange: 'okx', status: 'connected' })
    // Send a ping every 25 s to satisfy OKX's 30 s keepalive window
    heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 25_000)
  }

  ws.onmessage = (evt) => {
    if (evt.data === 'pong') return // heartbeat reply — ignore
    try {
      const msg = JSON.parse(evt.data as string) as OkxTickerMessage
      if (msg.arg?.channel === 'tickers' && msg.data?.length) {
        const tick = normalizeOkxTick(msg)
        if (tick) tickBuffer.push(tick)
      }
    } catch { /* malformed frame — skip */ }
  }

  ws.onclose = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    post({ type: 'CONNECTION_STATUS', exchange: 'okx', status: 'reconnecting' })
    sockets.delete('okx')
    setTimeout(() => connectOkx(pairs), RECONNECT_DELAY_MS)
  }

  ws.onerror = () => {
    post({ type: 'ERROR', exchange: 'okx', message: 'WebSocket error' })
  }

  sockets.set('okx', ws)
}

function connectCoinbase(pairs: string[]): void {
  // Coinbase Exchange uses USD not USDT: "BTC/USDT" → "BTC-USD"
  const productIds = pairs.map((p) => p.replace('/USDT', '-USD').replace('/', '-'))
  const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com')

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'subscribe',
      product_ids: productIds,
      channels: ['ticker'],
    }))
    post({ type: 'CONNECTION_STATUS', exchange: 'coinbase', status: 'connected' })
  }

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data as string) as CoinbaseTickerMessage
      if (msg.type === 'ticker' && msg.best_bid && msg.best_ask) {
        tickBuffer.push(normalizeCoinbaseTick(msg))
      }
    } catch { /* malformed frame — skip */ }
  }

  ws.onclose = () => {
    post({ type: 'CONNECTION_STATUS', exchange: 'coinbase', status: 'reconnecting' })
    sockets.delete('coinbase')
    setTimeout(() => connectCoinbase(pairs), RECONNECT_DELAY_MS)
  }

  ws.onerror = () => {
    post({ type: 'ERROR', exchange: 'coinbase', message: 'WebSocket error' })
  }

  sockets.set('coinbase', ws)
}

// ─── Worker message handler ───────────────────────────────────────────────────
self.addEventListener('message', (evt: MessageEvent<WorkerIncomingMessage>) => {
  const msg = evt.data

  if (msg.type === 'SUBSCRIBE') {
    if (!sockets.has('binance'))  connectBinance(msg.pairs)
    if (!sockets.has('kraken'))   connectKraken(msg.pairs)
    if (!sockets.has('okx'))      connectOkx(msg.pairs)
    if (!sockets.has('coinbase')) connectCoinbase(msg.pairs)
  }

  if (msg.type === 'UNSUBSCRIBE') {
    for (const ws of sockets.values()) ws.close()
    sockets.clear()
  }
})
