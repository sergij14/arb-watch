import { cn } from '@/lib/utils'

interface SpreadBadgeProps {
  value: number
  /** Number of decimal places to display (default 4) */
  decimals?: number
}

/**
 * Renders a coloured badge showing a spread percentage.
 * - Green  → positive (profitable after fees)
 * - Red    → negative (unprofitable)
 * - Amber  → very close to zero (±0.05%)
 */
export function SpreadBadge({ value, decimals = 4 }: SpreadBadgeProps) {
  const isPositive = value > 0.0001
  const isNegative = value < -0.0001

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums',
        isPositive && 'bg-green-500/20 text-green-400',
        isNegative && 'bg-red-500/20 text-red-400',
        !isPositive && !isNegative && 'bg-amber-500/20 text-amber-400',
      )}
    >
      {`${value.toFixed(decimals)}%`}
    </span>
  )
}
