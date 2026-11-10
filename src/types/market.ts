// ─── Supported exchanges ────────────────────────────────────────────────────
export type Exchange = 'binance' | 'kraken' | 'okx' | 'coinbase'

// ─── Normalized price tick (single source of truth for all adapters) ─────────
export interface PriceTick {
  exchange: Exchange
  /** Normalized pair format: "BTC/USDT" */
  pair: string
  bid: number
  ask: number
  /**
   * When this quote was received, in Unix ms on the local clock. Exchange-reported
   * times are skewed by each exchange's clock and by network latency, so they
   * can't be compared across exchanges to tell how old a quote is.
   */
  timestamp: number
}

// ─── Per-exchange fee config ──────────────────────────────────────────────────
export interface ExchangeFees {
  maker: number // decimal, e.g. 0.001 = 0.1%
  taker: number
}

export const EXCHANGE_FEES: Record<Exchange, ExchangeFees> = {
  binance:  { maker: 0.001,  taker: 0.001  },
  kraken:   { maker: 0.0016, taker: 0.0026 },
  okx:      { maker: 0.0008, taker: 0.001  },
  coinbase: { maker: 0.0006, taker: 0.0008 },
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

// ─── Worker message contracts ───────────────────────────────────────────────
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

/** OKX WebSocket v5 tickers channel payload */
export interface OkxTickerData {
  instId: string   // e.g. "BTC-USDT"
  bidPx:  string
  bidSz:  string
  askPx:  string
  askSz:  string
  ts:     string   // Unix ms as string
}

export interface OkxTickerMessage {
  arg:  { channel: string; instId: string }
  data: OkxTickerData[]
}

/** Coinbase Exchange (formerly Pro) WebSocket ticker message */
export interface CoinbaseTickerMessage {
  type:       'ticker'
  product_id: string   // e.g. "BTC-USD"
  best_bid:   string
  best_ask:   string
  time:       string   // ISO-8601
}
