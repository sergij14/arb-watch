import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriceTile } from '@/components/dashboard/PriceTile'
import type { PriceTick } from '@/types/market'

const BINANCE_TICK: PriceTick = {
  exchange: 'binance',
  pair: 'BTC/USDT',
  bid: 29500.5,
  ask: 29501.5,
  timestamp: Date.now(),
}

const KRAKEN_TICK: PriceTick = {
  exchange: 'kraken',
  pair: 'BTC/USDT',
  bid: 29510.0,
  ask: 29511.0,
  timestamp: Date.now(),
}

describe('PriceTile', () => {
  it('renders the exchange name', () => {
    render(<PriceTile tick={BINANCE_TICK} />)
    expect(screen.getByText(/binance/i)).toBeInTheDocument()
  })

  it('renders the trading pair', () => {
    render(<PriceTile tick={BINANCE_TICK} />)
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
  })

  it('renders the bid price', () => {
    render(<PriceTile tick={BINANCE_TICK} />)
    expect(screen.getByText(/29[,.]?500/)).toBeInTheDocument()
  })

  it('renders the ask price', () => {
    render(<PriceTile tick={BINANCE_TICK} />)
    expect(screen.getByText(/29[,.]?501/)).toBeInTheDocument()
  })

  it('shows "loading" state when tick is null', () => {
    render(<PriceTile tick={null} exchange="binance" pair="BTC/USDT" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('applies a green highlight class when isHigher=true', () => {
    const { container } = render(<PriceTile tick={KRAKEN_TICK} isHigher />)
    expect(container.firstChild).toHaveClass('border-green-500')
  })
})
