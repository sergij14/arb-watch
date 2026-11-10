import { useEffect, useState } from 'react'

/**
 * The current time, refreshed every `intervalMs`.
 *
 * Quote freshness can't be re-checked only when a price arrives: a dead feed
 * sends nothing, so its last quote would never age out. This clock re-renders
 * the dashboard on its own so stale quotes are caught even when every feed is
 * silent.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
