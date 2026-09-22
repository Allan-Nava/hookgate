// `hookgate report`: the README's columns, from the audit log (HG-10).
import { readDecisions } from './store.mjs'

const q = (xs, p) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

export function summarize(records) {
  const byGate = {}
  for (const r of records) {
    const g = (byGate[r.gate] ??= { total: 0, outcomes: {}, latencies: [], cached: 0, errors: 0, models: new Set(), confidences: [] })
    g.total += 1
    g.outcomes[r.outcome ?? 'unknown'] = (g.outcomes[r.outcome ?? 'unknown'] ?? 0) + 1
    if (r.outcome === 'error') g.errors += 1
    if (r.cached) g.cached += 1
    else if (typeof r.latencyMs === 'number') g.latencies.push(r.latencyMs)
    if (r.model) g.models.add(r.model)
    if (typeof r.confidence === 'number') g.confidences.push(r.confidence)
  }
  return Object.fromEntries(
    Object.entries(byGate).map(([gate, g]) => [
      gate,
      {
        total: g.total,
        outcomes: g.outcomes,
        p50: q(g.latencies, 0.5),
        p95: q(g.latencies, 0.95),
        cacheHitRate: g.total ? g.cached / g.total : 0,
        errors: g.errors,
        models: [...g.models],
        askShareAt: Object.fromEntries([0.5, 0.6, 0.7, 0.8, 0.9].map((t) => [t, g.confidences.length ? g.confidences.filter((c) => c < t).length / g.confidences.length : null])),
      },
    ]),
  )
}

export function render(summary) {
  const lines = []
  for (const [gate, s] of Object.entries(summary)) {
    lines.push(`## ${gate} — ${s.total} decisions`)
    lines.push(`outcomes: ${Object.entries(s.outcomes).map(([k, v]) => `${k} ${v}`).join(' · ')}${s.outcomes.skipped ? ` — ${Math.round((100 * s.outcomes.skipped) / s.total)}% never reached Jev` : ''}`)
    lines.push(`latency (uncached): p50 ${s.p50 ?? '—'} ms · p95 ${s.p95 ?? '—'} ms · cache hits ${Math.round(s.cacheHitRate * 100)}% · errors ${s.errors}`)
    lines.push(`share that would be "ask" at threshold: ${Object.entries(s.askShareAt).map(([t, v]) => `${t}→${v === null ? '—' : `${Math.round(v * 100)}%`}`).join('  ')}`)
    lines.push(`models: ${s.models.join(', ') || '—'}`, '')
  }
  return lines.join('\n') || 'no decisions logged yet'
}

export const report = (dir) => render(summarize(readDecisions(dir)))
