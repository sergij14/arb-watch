import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArbitrageTable } from '@/components/dashboard/ArbitrageTable'
import type { ArbitrageOpportunity } from '@/types/market'

const OPPORTUNITY: ArbitrageOpportunity = {
  pair: 'BTC/USDT',
  buyExchange: 'binance',
  sellExchange: 'kraken',
  buyAsk: 29506.0,
  sellBid: 29520.0,
  grossSpreadPct: 0.04744,
  netSpreadPct: -0.31256,
  netProfitUsd: -3.1256,
  timestamp: Date.now(),
}

const PROFITABLE_OPP: ArbitrageOpportunity = {
  ...OPPORTUNITY,
  grossSpreadPct: 0.9,
  netSpreadPct: 0.54,
  netProfitUsd: 5.4,
}

describe('ArbitrageTable', () => {
  it('renders a row for each opportunity', () => {
    render(<ArbitrageTable opportunities={[OPPORTUNITY, PROFITABLE_OPP]} />)
    const rows = screen.getAllByRole('row')
    // +1 for the header row
    expect(rows).toHaveLength(3)
  })

  it('renders the pair name in a row', () => {
    render(<ArbitrageTable opportunities={[OPPORTUNITY]} />)
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
  })

  it('renders the buy and sell exchange names', () => {
    render(<ArbitrageTable opportunities={[OPPORTUNITY]} />)
    expect(screen.getByText(/binance/i)).toBeInTheDocument()
    expect(screen.getByText(/kraken/i)).toBeInTheDocument()
  })

  it('renders grossSpreadPct rounded to 4 decimal places', () => {
    render(<ArbitrageTable opportunities={[OPPORTUNITY]} />)
    expect(screen.getByText(/0\.0474/)).toBeInTheDocument()
  })

  it('shows a "no opportunities" message when array is empty', () => {
    render(<ArbitrageTable opportunities={[]} />)
    expect(screen.getByText(/no opportunities/i)).toBeInTheDocument()
  })

  it('applies a green badge for a positive netSpreadPct', () => {
    render(<ArbitrageTable opportunities={[PROFITABLE_OPP]} />)
    // net spread 0.54 → 4 decimals → "0.5400%"
    const badge = screen.getByText('0.5400%')
    expect(badge.className).toMatch(/bg-green/)
  })

  it('applies a red badge for a negative netSpreadPct', () => {
    render(<ArbitrageTable opportunities={[OPPORTUNITY]} />)
    // net spread -0.31256 → 4 decimals → "-0.3126%"
    const badge = screen.getByText('-0.3126%')
    expect(badge.className).toMatch(/bg-red/)
  })
})
