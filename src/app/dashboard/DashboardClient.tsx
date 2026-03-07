'use client'

import { useMemo } from 'react'
import { PriceTile }      from '@/components/dashboard/PriceTile'
import { ArbitrageTable } from '@/components/dashboard/ArbitrageTable'
import { useWorkerStream } from '@/hooks/useWorkerStream'
import { calculateArbitrage } from '@/lib/arbitrage/calculator'
import type { ArbitrageOpportunity } from '@/types/market'

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']

export default function DashboardClient() {
  const { ticks, connected, error } = useWorkerStream(PAIRS)

  const opportunities = useMemo<ArbitrageOpportunity[]>(() => {
    return PAIRS.flatMap((pair) => {
      const pairTicks = ticks[pair]
      if (!pairTicks) return []
      const binanceTick = pairTicks.binance
      const krakenTick  = pairTicks.kraken
      if (!binanceTick || !krakenTick) return []
      return [calculateArbitrage(pair, binanceTick, krakenTick)]
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
        const pairTicks    = ticks[pair]
        const binanceTick  = pairTicks?.binance ?? null
        const krakenTick   = pairTicks?.kraken  ?? null

        const binanceHigher =
          !!binanceTick && !!krakenTick && binanceTick.bid > krakenTick.bid

        return (
          <section key={pair}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{pair}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-2">
              <PriceTile
                tick={binanceTick}
                exchange="binance"
                pair={pair}
                isHigher={binanceHigher}
              />
              <PriceTile
                tick={krakenTick}
                exchange="kraken"
                pair={pair}
                isHigher={!binanceHigher && !!krakenTick}
              />
            </div>
          </section>
        )
      })}

      {/* Arbitrage table */}
      <ArbitrageTable opportunities={opportunities} />
    </div>
  )
}
