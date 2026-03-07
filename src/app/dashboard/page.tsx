import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import DashboardSkeleton from './loading'

/**
 * Partial Prerendering (PPR):
 * The static shell (header, sidebar) is prerendered to HTML at build time.
 * The <Suspense> boundary wraps the real-time client component — Next.js
 * streams the static parts instantly while the dynamic chunk loads.
 */
export const experimental_cacheComponents = true

export const metadata = {
  title: 'Crypto Arbitrage Dashboard',
  description: 'Real-time cross-exchange arbitrage monitor powered by a Web Worker price stream',
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ── Static shell (prerendered) ─────────────────────────────── */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">⚡ Arb Watch</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Binance · Kraken
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Fee-aware cross-exchange spread monitor · Web Worker · 60 fps
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* ── Dynamic price stream (streamed via Suspense) ────────── */}
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardClient />
        </Suspense>
      </div>
    </main>
  )
}
