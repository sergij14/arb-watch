/**
 * loading.tsx — Suspense fallback for the dashboard dynamic segment.
 * Also exported as `DashboardSkeleton` for use in <Suspense fallback={}>.
 */
export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      {/* Status bar */}
      <div className="h-4 w-32 rounded bg-muted" />

      {/* 3 pair sections — 4 exchange tiles each */}
      {[0, 1, 2].map((i) => (
        <section key={i}>
          <div className="mb-2 h-4 w-20 rounded bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="h-24 rounded-xl border border-border bg-muted" />
            ))}
          </div>
        </section>
      ))}

      {/* Arbitrage table */}
      <div className="h-52 rounded-xl border border-border bg-muted" />
    </div>
  )
}
