import { EXCHANGE_FEES } from '@/types/market'
import type { ArbitrageOpportunity, Exchange, PriceTick } from '@/types/market'

const NOTIONAL_USD = 1_000

/**
 * Given price ticks from exactly two different exchanges for the same pair,
 * returns an {@link ArbitrageOpportunity} describing the best cross-exchange spread.
 *
 * - Buy on the exchange with the lower ask.
 * - Sell on the exchange with the higher bid.
 * - Net spread subtracts the taker fee from each leg.
 */
export function calculateArbitrage(
  pair: string,
  tickA: PriceTick,
  tickB: PriceTick,
): ArbitrageOpportunity {
  // Which side do we buy on (lower ask) vs sell on (higher bid)?
  const [buyTick, sellTick] = tickA.ask <= tickB.ask ? [tickA, tickB] : [tickB, tickA]

  const buyAsk  = buyTick.ask
  const sellBid = sellTick.bid

  const grossSpreadPct = ((sellBid - buyAsk) / buyAsk) * 100

  // Round-trip taker fee cost as a percentage
  const feePct =
    EXCHANGE_FEES[buyTick.exchange as Exchange].taker * 100 +
    EXCHANGE_FEES[sellTick.exchange as Exchange].taker * 100

  const netSpreadPct = grossSpreadPct - feePct
  const netProfitUsd = (netSpreadPct / 100) * NOTIONAL_USD

  return {
    pair,
    buyExchange: buyTick.exchange,
    sellExchange: sellTick.exchange,
    buyAsk,
    sellBid,
    grossSpreadPct,
    netSpreadPct,
    netProfitUsd,
    timestamp: Math.max(tickA.timestamp, tickB.timestamp),
  }
}

/**
 * Given an array of price ticks (potentially from multiple pairs and exchanges),
 * groups them by pair, calculates the arbitrage for each pair that has ticks from
 * at least two exchanges, and returns the opportunity with the highest `netSpreadPct`.
 *
 * Returns `null` when no qualifying pair exists.
 */
export function findBestOpportunity(ticks: PriceTick[]): ArbitrageOpportunity | null {
  // Group ticks by pair
  const byPair = new Map<string, PriceTick[]>()
  for (const tick of ticks) {
    const list = byPair.get(tick.pair) ?? []
    list.push(tick)
    byPair.set(tick.pair, list)
  }

  let best: ArbitrageOpportunity | null = null

  for (const [pair, pairTicks] of byPair.entries()) {
    // Deduplicate to one tick per exchange (take the most recent)
    const byExchange = new Map<Exchange, PriceTick>()
    for (const t of pairTicks) {
      const existing = byExchange.get(t.exchange)
      if (!existing || t.timestamp > existing.timestamp) {
        byExchange.set(t.exchange, t)
      }
    }

    const exchangeTicks = [...byExchange.values()]
    if (exchangeTicks.length < 2) continue

    const opp = calculateArbitrage(pair, exchangeTicks[0], exchangeTicks[1])
    if (!best || opp.netSpreadPct > best.netSpreadPct) {
      best = opp
    }
  }

  return best
}
