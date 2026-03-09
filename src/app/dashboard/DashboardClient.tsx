'use client'

import { useMemo } from 'react'
import { PriceTile }      from '@/components/dashboard/PriceTile'
import { ArbitrageTable } from '@/components/dashboard/ArbitrageTable'
import { useWorkerStream } from '@/hooks/useWorkerStream'
import { calculateArbitrage } from '@/lib/arbitrage/calculator'
import type { ArbitrageOpportunity, Exchange } from '@/types/market'

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']
const ALL_EXCHANGES: Exchange[] = ['binance', 'kraken', 'okx', 'coinbase']

export default function DashboardClient() {
  const { ticks, connected, error } = useWorkerStream(PAIRS)

  const opportunities = useMemo<ArbitrageOpportunity[]>(() => {
    return PAIRS.flatMap((pair) => {
      const pairTicks = ticks[pair]
      if (!pairTicks) return []

      // Collect ticks from all connected exchanges for this pair
      const exchangeTicks = ALL_EXCHANGES
        .map((ex) => pairTicks[ex])
        .filter((t): t is NonNullable<typeof t> => !!t)

      if (exchangeTicks.length < 2) return []

      // Find the best arbitrage across all C(n,2) exchange pairs
      let best: ArbitrageOpportunity | null = null
      for (let i = 0; i < exchangeTicks.length; i++) {
        for (let j = i + 1; j < exchangeTicks.length; j++) {
          const opp = calculateArbitrage(pair, exchangeTicks[i], exchangeTicks[j])
          if (!best || opp.netSpreadPct > best.netSpreadPct) best = opp
        }
      }
      return best ? [best] : []
    })
  }, [ticks])

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        {connected ? 'Live feed active' : 'Connecting…'}
        {error && (
          <span className="ml-2 text-red-400">Error: {error}</span>
        )}
      </div>

      {/* Per-pair price tiles grid */}
      {PAIRS.map((pair) => {
        const pairTicks = ticks[pair]

        // Find the exchange with the highest bid for highlighting
        const highestBidExchange = ALL_EXCHANGES.reduce<Exchange | null>((best, ex) => {
          const tick = pairTicks?.[ex]
          if (!tick) return best
          const bestTick = best ? pairTicks?.[best] : null
          return !bestTick || tick.bid > bestTick.bid ? ex : best
        }, null)

        return (
          <section key={pair}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{pair}</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {ALL_EXCHANGES.map((exchange) => (
                <PriceTile
                  key={exchange}
                  tick={pairTicks?.[exchange] ?? null}
                  exchange={exchange}
                  pair={pair}
                  isHigher={highestBidExchange === exchange}
                />
              ))}
            </div>
          </section>
        )
      })}

      {/* Arbitrage table */}
      <ArbitrageTable opportunities={opportunities} />
    </div>
  )
}

