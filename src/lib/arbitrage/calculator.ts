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
 * Best opportunity for one pair across every combination of exchanges.
 *
 * Fees differ per exchange, so the cheapest ask and the highest bid aren't always
 * the best net trade — each of the C(n,2) combinations is scored after fees.
 * Expects at most one tick per exchange. Returns `null` with fewer than two.
 */
export function findBestForPair(pair: string, ticks: PriceTick[]): ArbitrageOpportunity | null {
  let best: ArbitrageOpportunity | null = null

  for (let i = 0; i < ticks.length; i++) {
    for (let j = i + 1; j < ticks.length; j++) {
      const opp = calculateArbitrage(pair, ticks[i], ticks[j])
      if (!best || opp.netSpreadPct > best.netSpreadPct) best = opp
    }
  }

  return best
}

/**
 * Given an array of price ticks (potentially from multiple pairs and exchanges),
 * groups them by pair, calculates the arbitrage for each pair that has ticks from
 * at least two exchanges, and returns the opportunity with the highest `netSpreadPct`.
 *
 * Returns `null` when no qualifying pair exists.
 */
export function findBestOpportunity(ticks: PriceTick[]): ArbitrageOpportunity | null {
  // Group ticks by pair, keeping the most recent tick per exchange
  const byPair = new Map<string, Map<Exchange, PriceTick>>()
  for (const tick of ticks) {
    const byExchange = byPair.get(tick.pair) ?? new Map<Exchange, PriceTick>()
    const existing = byExchange.get(tick.exchange)
    if (!existing || tick.timestamp > existing.timestamp) {
      byExchange.set(tick.exchange, tick)
    }
    byPair.set(tick.pair, byExchange)
  }

  let best: ArbitrageOpportunity | null = null

  for (const [pair, byExchange] of byPair) {
    const opp = findBestForPair(pair, [...byExchange.values()])
    if (opp && (!best || opp.netSpreadPct > best.netSpreadPct)) {
      best = opp
    }
  }

  return best
}
