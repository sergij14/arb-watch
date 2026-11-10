'use client'

import { useMemo } from 'react'
import { PriceTile }      from '@/components/dashboard/PriceTile'
import { ArbitrageTable } from '@/components/dashboard/ArbitrageTable'
import { useNow }          from '@/hooks/useNow'
import { useWorkerStream } from '@/hooks/useWorkerStream'
import { findBestForPair } from '@/lib/arbitrage/calculator'
import { freshTicks }      from '@/lib/arbitrage/freshness'
import { cn } from '@/lib/utils'
import type { ArbitrageOpportunity, ConnectionStatus, Exchange, PriceTick } from '@/types/market'

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']
const ALL_EXCHANGES: Exchange[] = ['binance', 'kraken', 'okx', 'coinbase']

const EXCHANGE_LABELS: Record<Exchange, string> = {
  binance:  'Binance',
  kraken:   'Kraken',
  okx:      'OKX',
  coinbase: 'Coinbase',
}

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected:    'bg-green-500',
  reconnecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-red-500',
}

/** How often quote ages are re-checked when no new prices arrive. */
const FRESHNESS_CHECK_MS = 1_000

export default function DashboardClient() {
  const { ticks, connected, error, exchangeStatus } = useWorkerStream(PAIRS)
  const now = useNow(FRESHNESS_CHECK_MS)

  // Only quotes that are fresh and from a connected exchange, per pair. Arbitrage
  // and the highest-bid highlight are computed from these alone: a frozen quote
  // next to a live one shows a spread that doesn't exist.
  const freshByPair = useMemo(
    () => Object.fromEntries(PAIRS.map((pair) => [pair, freshTicks(ticks[pair], now, exchangeStatus)])),
    [ticks, now, exchangeStatus],
  )

  const opportunities = useMemo<ArbitrageOpportunity[]>(
    () =>
      PAIRS.flatMap((pair) => {
        const best = findBestForPair(pair, freshByPair[pair])
        return best ? [best] : []
      }),
    [freshByPair],
  )

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          {connected ? 'Live feed active' : 'Connecting…'}
        </span>
        <span className="flex items-center gap-3" aria-label="Exchange connections">
          {ALL_EXCHANGES.map((exchange) => {
            const status = exchangeStatus[exchange]
            return (
              <span key={exchange} className="flex items-center gap-1" title={status ?? 'connecting'}>
                <span className={cn('h-1.5 w-1.5 rounded-full', status ? STATUS_DOT[status] : 'bg-muted-foreground/40')} />
                {EXCHANGE_LABELS[exchange]}
              </span>
            )
          })}
        </span>
        {error && (
          <span className="text-red-400">Error: {error}</span>
        )}
      </div>

      {/* Per-pair price tiles grid */}
      {PAIRS.map((pair) => {
        const pairTicks = ticks[pair]
        const fresh = freshByPair[pair]

        // Highest bid among fresh quotes, for highlighting
        const highestBid = fresh.reduce<PriceTick | null>(
          (best, tick) => (!best || tick.bid > best.bid ? tick : best),
          null,
        )

        return (
          <section key={pair}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{pair}</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {ALL_EXCHANGES.map((exchange) => {
                const tick = pairTicks?.[exchange] ?? null
                return (
                  <PriceTile
                    key={exchange}
                    tick={tick}
                    exchange={exchange}
                    pair={pair}
                    isHigher={highestBid?.exchange === exchange}
                    stale={!!tick && !fresh.includes(tick)}
                  />
                )
              })}
            </div>
          </section>
        )
      })}

      {/* Arbitrage table */}
      <ArbitrageTable opportunities={opportunities} />
    </div>
  )
}
