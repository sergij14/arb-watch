import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import DashboardSkeleton from './loading'

export const experimental_cacheComponents = true

export const metadata = {
  title: 'Arb Watch — Crypto Arbitrage Dashboard',
  description: 'Real-time cross-exchange arbitrage monitor powered by a Web Worker price stream',
}

const EXCHANGES = ['Binance', 'Kraken', 'OKX', 'Coinbase'] as const

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">

          {/* Branding */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight">⚡ Arb Watch</span>
            </div>
            <p className="text-[11px] leading-tight text-muted-foreground">
              Fee-aware spread monitor · Web Worker · 60 fps
            </p>
          </div>

          {/* Exchange chips */}
          <div className="hidden items-center gap-1.5 sm:flex">
            {EXCHANGES.map((ex) => (
              <span
                key={ex}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {ex}
              </span>
            ))}
          </div>

        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardClient />
        </Suspense>
      </main>

    </div>
  )
}

