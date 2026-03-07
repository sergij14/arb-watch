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
}

const EXCHANGE_LABELS: Record<Exchange, string> = {
  binance: 'Binance',
  kraken:  'Kraken',
}

/**
 * Displays the current bid/ask for a single exchange.
 * Renders a skeleton loader when `tick` is null or undefined.
 */
export function PriceTile({ tick, exchange, pair, isHigher = false }: PriceTileProps) {
  const resolvedExchange = tick?.exchange ?? exchange
  const resolvedPair     = tick?.pair     ?? pair ?? '—'
  const label            = resolvedExchange ? EXCHANGE_LABELS[resolvedExchange] : '—'

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 shadow-sm transition-colors duration-300',
        isHigher ? 'border-green-500' : 'border-border',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-xs font-medium text-foreground/60">{resolvedPair}</span>
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
