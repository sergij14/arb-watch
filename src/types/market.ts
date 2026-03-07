// ─── Supported exchanges ────────────────────────────────────────────────────
export type Exchange = 'binance' | 'kraken'

// ─── Normalized price tick (single source of truth for all adapters) ─────────
export interface PriceTick {
  exchange: Exchange
  /** Normalized pair format: "BTC/USDT" */
  pair: string
  bid: number
  ask: number
  /** Unix milliseconds */
  timestamp: number
}

// ─── Per-exchange fee config ──────────────────────────────────────────────────
export interface ExchangeFees {
  maker: number // decimal, e.g. 0.001 = 0.1%
  taker: number
}

export const EXCHANGE_FEES: Record<Exchange, ExchangeFees> = {
  binance: { maker: 0.001, taker: 0.001 },
  kraken:  { maker: 0.0016, taker: 0.0026 },
}

// ─── Arbitrage opportunity ────────────────────────────────────────────────────
export interface ArbitrageOpportunity {
  pair: string
  buyExchange: Exchange
  sellExchange: Exchange
  buyAsk: number
  sellBid: number
  /** (sellBid - buyAsk) / buyAsk * 100 */
  grossSpreadPct: number
  /** grossSpreadPct minus round-trip taker fees */
  netSpreadPct: number
  /** Net profit in USD per $1,000 notional */
  netProfitUsd: number
  timestamp: number
}

// ─── SharedWorker message contracts ──────────────────────────────────────────
export type WorkerIncomingMessage =
  | { type: 'SUBSCRIBE';   pairs: string[] }
  | { type: 'UNSUBSCRIBE'; pairs: string[] }

export type WorkerOutgoingMessage =
  | { type: 'PRICE_BATCH';        updates: PriceTick[] }
  | { type: 'ERROR';              exchange: Exchange; message: string }
  | { type: 'CONNECTION_STATUS';  exchange: Exchange; status: ConnectionStatus }

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

// ─── Raw exchange message shapes (used by adapters) ──────────────────────────

/** Binance bookTicker stream payload */
export interface BinanceBookTicker {
  u: number   // update id
  s: string   // symbol, e.g. "BTCUSDT"
  b: string   // best bid price
  B: string   // best bid qty
  a: string   // best ask price
  A: string   // best ask qty
}

/** Kraken WebSocket v2 ticker data entry */
export interface KrakenTickerData {
  symbol: string   // e.g. "BTC/USD"
  bid: number
  bid_qty: number
  ask: number
  ask_qty: number
  last: number
  volume: number
  vwap: number
  low: number
  high: number
  change: number
  change_pct: number
}

export interface KrakenTickerMessage {
  channel: string
  type: string
  data: KrakenTickerData[]
}
