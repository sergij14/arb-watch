import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SpreadBadge } from './SpreadBadge'
import type { ArbitrageOpportunity } from '@/types/market'

interface ArbitrageTableProps {
  opportunities: ArbitrageOpportunity[]
}

const EXCHANGE_LABELS: Record<string, string> = {
  binance:  'Binance',
  kraken:   'Kraken',
  okx:      'OKX',
  coinbase: 'Coinbase',
}

/**
 * Tabular view of arbitrage opportunities across all monitored pairs.
 * Rows are sorted by netSpreadPct descending.
 */
export function ArbitrageTable({ opportunities }: ArbitrageTableProps) {
  const sorted = [...opportunities].sort((a, b) => b.netSpreadPct - a.netSpreadPct)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Arbitrage Opportunities</h2>
        <p className="text-xs text-muted-foreground">
          Sorted by net spread after fees · $1,000 notional
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No opportunities detected
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pair</TableHead>
              <TableHead>Buy on</TableHead>
              <TableHead>Buy ask</TableHead>
              <TableHead>Sell on</TableHead>
              <TableHead>Sell bid</TableHead>
              <TableHead className="text-right">Gross %</TableHead>
              <TableHead className="text-right">Net %</TableHead>
              <TableHead className="text-right">Net P&L ($)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((opp) => (
              <TableRow key={opp.pair}>
                <TableCell className="font-mono font-medium">{opp.pair}</TableCell>
                <TableCell className="capitalize">{EXCHANGE_LABELS[opp.buyExchange]}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {opp.buyAsk.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="capitalize">{EXCHANGE_LABELS[opp.sellExchange]}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {opp.sellBid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right">
                  <SpreadBadge value={opp.grossSpreadPct} decimals={4} />
                </TableCell>
                <TableCell className="text-right">
                  <SpreadBadge value={opp.netSpreadPct} decimals={4} />
                </TableCell>
                <TableCell
                  className={`text-right font-mono tabular-nums ${
                    opp.netProfitUsd > 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {opp.netProfitUsd > 0 ? '+' : ''}
                  {opp.netProfitUsd.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
