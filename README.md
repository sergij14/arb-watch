# Case Study: Arb Watch — Crypto Arbitrage Dashboard

> Real-time, fee-aware cross-exchange spread monitor for BTC/USDT, ETH/USDT, and SOL/USDT across Binance, Kraken, OKX and Coinbase.

### Overview

Arb Watch is a production-quality Next.js 16 application that streams live order-book data from four cryptocurrency exchanges simultaneously, normalizes it into a unified format, and surfaces fee-adjusted arbitrage opportunities in real time. The project was built end-to-end using **Test-Driven Development (TDD)** — every layer of the codebase was covered by failing tests before implementation began.

---

### The Problem

Cryptocurrency prices differ across exchanges at any given moment. A trader who can buy BTC/USDT cheaply on Binance and simultaneously sell it on Kraken at a higher bid captures a risk-free spread — but only if that spread exceeds the round-trip taker fees on both legs. Monitoring this manually across multiple pairs and exchanges in real time is not practical.

The goal was to build a dashboard that:
- Connects to four exchange WebSocket feeds off the main thread
- Normalizes raw, exchange-specific message formats into a shared schema
- Calculates fee-adjusted net spread and per-$1,000 profit for every pair
- Never reports a spread built on a quote that has gone stale
- Updates at up to 60 fps without blocking the UI

---

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Main Thread                   │
│                                                         │
│  DashboardClient (React, 'use client')                  │
│    └── useWorkerStream hook                             │
│          └── posts SUBSCRIBE / reads PRICE_BATCH        │
└─────────────────┬───────────────────────────────────────┘
                  │  MessageChannel (structured clone)
┌─────────────────▼───────────────────────────────────────┐
│                    Web Worker thread                     │
│                                                         │
│  priceWorker.ts                                         │
│    ├── connectBinance()  →  wss://stream.binance.com    │
│    │     normalizeBinanceTick()  →  PriceTick           │
│    ├── connectKraken()   →  wss://ws.kraken.com/v2      │
│    │     normalizeKrakenTicks()  →  PriceTick[]         │
│    ├── connectOkx()      →  wss://ws.okx.com/ws/v5      │
│    ├── connectCoinbase() →  wss://ws-feed.exchange...   │
│    └── setInterval(flushBatch, 16ms)  →  PRICE_BATCH    │
└─────────────────────────────────────────────────────────┘
```

**Web Worker isolation** is the core architectural choice. All four WebSocket connections live entirely off the main thread. The worker accumulates raw ticks in a local buffer and flushes them as a batch every 16 ms. This means React state updates at most once per animation frame regardless of how fast the exchange feeds arrive, keeping the UI at a smooth 60 fps.

**Partial Prerendering (PPR)** via `cacheComponents: true` in Next.js 16 means the static shell (header, exchange labels) is prerendered to HTML at build time. The `<Suspense>` boundary around `DashboardClient` streams the skeleton instantly while the dynamic price stream hydrates — zero layout shift on load.

---

### Data Flow

1. On mount, `useWorkerStream` spawns a `Worker` and posts `{ type: 'SUBSCRIBE', pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'] }`.
2. The worker opens one WebSocket per exchange. Binance uses the multi-stream bookTicker endpoint; Kraken uses WebSocket API v2 with `event_trigger: 'bbo'`; OKX uses the v5 `tickers` channel (with a 25 s ping keepalive); Coinbase uses the `ticker` channel.
3. Each incoming message is passed through an adapter:
   - **Binance**: `BTCUSDT` → `BTC/USDT`, string prices parsed to floats.
   - **Kraken**: v2 messages carry a `data` array (multiple pairs per frame), so `normalizeKrakenTicks()` returns `PriceTick[]`.
   - **OKX / Coinbase**: `BTC-USDT` / `BTC-USD` → `BTC/USDT`.
   - Every adapter stamps the tick with the **local receive time**, so quote ages are measured on one clock.
4. Every 16 ms the worker flushes its buffer as `{ type: 'PRICE_BATCH', updates: PriceTick[] }`.
5. The hook reduces each batch into a `TickMap = Record<pair, Record<exchange, PriceTick>>` via `setState`.
6. `DashboardClient` drops stale quotes with `freshTicks()`, then derives `ArbitrageOpportunity[]` via `useMemo`, calling `findBestForPair()` per pair.

---

### Fee-Aware Spread Calculation

For each pair, every combination of two exchanges with a fresh quote (C(4,2) = 6) is scored:

```
grossSpread = (sellBid − buyAsk) / buyAsk × 100

feeCost     = buyExchangeTaker% + sellExchangeTaker%
            e.g. Binance → Kraken = 0.10% + 0.26% = 0.36%

netSpread   = grossSpread − feeCost
netProfit   = (netSpread / 100) × $1,000 notional
```

Exchange fees used:

| Exchange | Maker  | Taker  |
|----------|--------|--------|
| Binance  | 0.10%  | 0.10%  |
| Kraken   | 0.16%  | 0.26%  |
| OKX      | 0.08%  | 0.10%  |
| Coinbase | 0.06%  | 0.08%  |

Within each combination the algorithm buys on the lower-ask exchange and sells on the higher-bid exchange, and the combination with the best net spread wins. Fees differ per exchange, so the cheapest ask and the highest bid aren't always the best trade after fees. A negative `netSpread` means the opportunity doesn't cover fees and is shown in red.

---

### Test-Driven Development

Every layer was written test-first. Tests were run in Vitest + React Testing Library against a jsdom environment. The workflow for each module was: write failing tests → implement until green → commit the pair together.

| Module | Tests | What's covered |
|---|---|---|
| `binance.ts` adapter | 8 | Pair normalization, float parsing, PriceTick shape |
| `kraken.ts` adapter | 15 | Single and multi-item messages, snapshot vs update, error guards |
| `okx.ts` adapter | 5 | Pair normalization, unparseable prices, receive-time stamping |
| `coinbase.ts` adapter | 4 | USD → USDT pair mapping, receive-time stamping |
| `calculator.ts` | 16 | Buy/sell direction, gross spread, fee deduction, all C(n,2) combinations, fee-aware selection |
| `freshness.ts` | 8 | Age threshold boundary, disconnected/reconnecting/unknown exchanges, per-pair filtering |
| `useWorkerStream` hook | 10 | Worker lifecycle, SUBSCRIBE, PRICE_BATCH reduction, per-exchange status, unmount cleanup |
| `PriceTile` component | 9 | Render bid/ask, skeleton state, highlight on higher bid, stale marking |
| `ArbitrageTable` component | 7 | Row per opportunity, empty state, badge colors |
| **Total** | **82** | All passing |

---

### Engineering Challenges

#### 1. SharedWorker → dedicated Web Worker

The original design used a `SharedWorker` so that multiple browser tabs could share a single WebSocket connection. Next.js webpack does not auto-bundle `SharedWorker` files — the `onconnect` handler was never reached and the app was permanently stuck on "Connecting…".

**Fix**: Replaced with a standard `Worker` (`new Worker(new URL(...))`), which Next.js bundles automatically. The tradeoff is one connection per tab rather than one shared connection, which is acceptable for this use case.

#### 2. Kraken snapshot messages silently dropped

Kraken's WebSocket v2 protocol sends an initial `type: "snapshot"` message containing **all subscribed pairs in a single frame** before transitioning to per-pair `type: "update"` frames. The worker was only handling `"update"`, so BTC received its first tick eventually (it happened to arrive as an update quickly) but ETH and SOL — whose data was exclusively in the snapshot — never populated.

Two bugs compounded each other:
- The worker filtered `msg.type !== 'update'`, discarding the snapshot entirely.
- The adapter read only `raw.data[0]`, so even if the snapshot had been accepted only the first pair (BTC) would have been processed.

**Fix**: Changed the condition to `type === 'update' || type === 'snapshot'`, and changed `normalizeKrakenTick` to `normalizeKrakenTicks` returning `PriceTick[]` by mapping over the full `data` array. The single-item convenience wrapper `normalizeKrakenTick` was kept for tests that check a specific entry.

#### 3. Next.js 16 PPR API changes

Next.js changed the Partial Prerendering configuration API across minor versions. `experimental.ppr: 'incremental'` was renamed to `experimental.cacheComponents: true`, then moved out of `experimental` to the root config level. The route-level export changed in parallel from `experimental_ppr` to `experimental_cacheComponents`.

#### 4. Stale quotes produce phantom arbitrage

A spread is only real if both quotes describe the market *now*. The dashboard kept the last quote from every exchange forever, so when a socket dropped, or a feed went quiet, its frozen price was still compared against live ones and could show a spread that no longer existed. That's the most common way an arbitrage monitor lies.

To size the problem, I recorded 30 seconds of every feed and measured the longest gap between updates per pair:

| Feed | BTC/USDT | ETH/USDT | SOL/USDT |
|---|---|---|---|
| Binance `bookTicker` | 0.5 s | 0.5 s | 0.7 s |
| OKX `tickers` | 0.7 s | 0.6 s | 0.5 s |
| Coinbase `ticker` (USD) | 1.0 s | 2.7 s | 3.7 s |
| Kraken `ticker`, default trigger | **18 s** | **21 s** | **30 s+** |
| Kraken `ticker`, `event_trigger: 'bbo'` | 0.8 s | 2.2 s | 2.9 s |

Kraken's ticker fires on *trades* by default. On its thinner USDT books a trade can be 20+ seconds away while the best bid and ask move, so most of the Kraken prices the dashboard had been showing were out of date. Subscribing with `event_trigger: 'bbo'` pushes on every best-bid/offer change instead.

With every healthy feed under ~4 s, the fix has three parts:

- **One clock.** OKX and Coinbase had stamped ticks with exchange-reported time, while Binance and Kraken used receive time. Ages measured on different clocks can't be compared, so every adapter now stamps the local receive time.
- **A freshness rule.** `isStale()` rejects a quote older than 5 s or from an exchange that isn't currently `connected`. A dropped socket invalidates its quotes immediately instead of waiting out the timer.
- **Stale quotes are excluded, not just greyed out.** They're filtered out before `findBestForPair()` and the highest-bid highlight. Their tiles are dimmed and labelled *Stale* so the last known price is still visible. A `useNow(1000)` clock re-renders the dashboard every second, because a dead feed sends no messages that would otherwise trigger the re-check.

Writing the tests for this exposed two older bugs. `findBestOpportunity()` compared only the first two exchanges of each pair, which went unnoticed when there were only two. And the "Live feed" indicator was set by whichever exchange reported its status last, so one dropped socket out of four made the whole feed read as down. Both are now covered by tests: all C(n,2) combinations are scored, and `connected` is derived from every exchange's status.

#### 5. Known limitation: USD vs USDT

Coinbase's deep books are USD, not USDT, so `BTC-USD` is compared against other exchanges' `BTC/USDT`. That's the standard proxy, but USDT trades a few basis points away from $1, so Coinbase spreads include that drift. Converting through a live USDT/USD rate would remove it.

---

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| UI | React 19, shadcn/ui (base-nova), Tailwind CSS v4 |
| Real-time | Web Worker + WebSocket (Binance bookTicker, Kraken WS v2) |
| Testing | Vitest 4, React Testing Library 16, jsdom |
| Language | TypeScript 5 (strict mode) |
| Charts | Recharts (installed, planned for sparklines) |

---

### Running Locally

```bash
npm install
npm run dev        # http://localhost:3000 → redirects to /dashboard
npm test           # 82 unit tests
npm run test:coverage
```

---

### Project Structure

```
src/
├── types/market.ts              # Shared interfaces: PriceTick, ArbitrageOpportunity, Exchange
├── lib/
│   ├── adapters/
│   │   ├── binance.ts           # normalizeBinanceTick()
│   │   ├── kraken.ts            # normalizeKrakenTicks() / normalizeKrakenTick()
│   │   ├── okx.ts               # normalizeOkxTick()
│   │   └── coinbase.ts          # normalizeCoinbaseTick()
│   ├── arbitrage/
│   │   ├── calculator.ts        # calculateArbitrage(), findBestForPair(), findBestOpportunity()
│   │   └── freshness.ts         # isStale(), freshTicks(), STALE_AFTER_MS
│   └── worker/
│       └── priceWorker.ts       # Web Worker: WebSockets → batch flush → PRICE_BATCH
├── hooks/
│   ├── useWorkerStream.ts       # React hook: spawns worker, exposes TickMap + per-exchange status
│   └── useNow.ts                # 1 s clock so quote ages are re-checked when feeds go quiet
├── components/dashboard/
│   ├── PriceTile.tsx            # Per-exchange bid/ask card with skeleton
│   ├── ArbitrageTable.tsx       # Sorted opportunity table
│   └── SpreadBadge.tsx          # Color-coded spread % badge
└── app/
    ├── layout.tsx               # Root layout with Geist font + TooltipProvider
    └── dashboard/
        ├── page.tsx             # PPR shell + Suspense boundary
        ├── DashboardClient.tsx  # 'use client' — subscribes to worker, renders grid
        └── loading.tsx          # Animated skeleton (Suspense fallback)
```

