import type { ConnectionStatus, Exchange, PriceTick } from '@/types/market'

/**
 * A quote not refreshed within this window is no longer trusted.
 *
 * Measured over 30 s of live feeds, the longest gap between updates on a healthy
 * connection was ~3.7 s (Coinbase SOL-USD, whose ticker only fires on trades);
 * Binance, OKX and Kraken (on best-bid/offer triggers) stayed under ~3 s.
 */
export const STALE_AFTER_MS = 5_000

/**
 * A quote is stale when its exchange isn't connected (the socket dropped, so the
 * book may have moved without us hearing about it) or when nothing has arrived
 * for longer than {@link STALE_AFTER_MS}.
 *
 * Comparing a frozen quote against a live one shows a spread that doesn't exist,
 * so stale quotes are excluded from arbitrage, not just greyed out.
 */
export function isStale(
  tick: PriceTick,
  now: number,
  status: ConnectionStatus | undefined,
): boolean {
  return status !== 'connected' || now - tick.timestamp > STALE_AFTER_MS
}

/** The quotes for one pair that are safe to trade against right now. */
export function freshTicks(
  ticks: Partial<Record<Exchange, PriceTick>> | undefined,
  now: number,
  status: Partial<Record<Exchange, ConnectionStatus>>,
): PriceTick[] {
  if (!ticks) return []
  return Object.values(ticks).filter(
    (tick): tick is PriceTick => !!tick && !isStale(tick, now, status[tick.exchange]),
  )
}
