import { cn } from '@/lib/utils'
import type { Exchange, PriceTick } from '@/types/market'

interface PriceTileProps {
  /** The latest tick to display. Pass null/undefined while loading. */
  tick?: PriceTick | null
  /** Required when tick is null so we can still show the placeholder label. */
  exchange?: Exchange
  pair?: string
  /** Highlights the tile with a green border (this exchange has the highest bid). */
  isHigher?: boolean
  /** The quote is too old, or its exchange is disconnected, so it's not traded on. */
  stale?: boolean
}

const EXCHANGE_LABELS: Record<Exchange, string> = {
  binance:  'Binance',
  kraken:   'Kraken',
  okx:      'OKX',
  coinbase: 'Coinbase',
}

/**
 * Displays the current bid/ask for a single exchange.
 * Renders a skeleton loader when `tick` is null or undefined.
 */
export function PriceTile({ tick, exchange, pair, isHigher = false, stale = false }: PriceTileProps) {
  const resolvedExchange = tick?.exchange ?? exchange
  const resolvedPair     = tick?.pair     ?? pair ?? '—'
  const label            = resolvedExchange ? EXCHANGE_LABELS[resolvedExchange] : '—'

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-3 shadow-sm transition-[border-color,opacity] duration-300 sm:p-4',
        isHigher ? 'border-green-500' : 'border-border',
        stale && 'opacity-50',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
          {stale && (
            <span
              className="rounded border border-amber-500/50 px-1 text-[10px] tracking-normal text-amber-500"
              title="No fresh quote: excluded from arbitrage"
            >
              Stale
            </span>
          )}
        </span>
        {/* Hidden on phones: the section heading already names the pair, and the
            two-column tiles are too narrow for exchange, Stale badge and pair. */}
        <span className="hidden text-xs font-medium text-foreground/60 sm:inline">{resolvedPair}</span>
      </div>

      {tick ? (
        <div className="space-y-1">
          <PriceRow label="Bid" value={tick.bid} className="text-green-400" />
          <PriceRow label="Ask" value={tick.ask} className="text-red-400" />
        </div>
      ) : (
        <div role="status" aria-label="Loading price data" className="space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      )}
    </div>
  )
}

function PriceRow({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('font-mono text-sm font-semibold tabular-nums', className)}>
        {value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  )
}
