// Everything the plugin remembers lives under the harness's plugin data directory:
// the audit log (HG-10), the per-session cache (HG-12), the promotion counters (HG-13)
// and the one-block-per-stop marker. Every write is best-effort — a full disk must
// not turn into a blocked tool call.
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const safe = (fn) => {
  try {
    return fn()
  } catch {
    return undefined
  }
}

export const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

// The audit log rotates once at LOG_MAX bytes: decisions.jsonl → decisions.1.jsonl,
// the previous .1 dropped. Two files bound the disk; `report` reads both.
export const LOG_MAX = 8 * 1024 * 1024

export function appendDecision(dir, record) {
  safe(() => {
    mkdirSync(dir, { recursive: true })
    const p = join(dir, 'decisions.jsonl')
    // No exists-then-stat: read the size in one call and let a missing file throw into `safe`.
    const size = safe(() => statSync(p).size) ?? 0
    if (size > LOG_MAX) renameSync(p, join(dir, 'decisions.1.jsonl'))
    appendFileSync(p, `${JSON.stringify(record)}\n`)
  })
}

export function readDecisions(dir) {
  return ['decisions.1.jsonl', 'decisions.jsonl']
    .map((f) => safe(() => readFileSync(join(dir, f), 'utf8')) ?? '')
    .flatMap((text) => text.split('\n'))
    .filter(Boolean)
    .map((l) => safe(() => JSON.parse(l)))
    .filter(Boolean)
}

// Per-session state: cache entries and promotion counters, one JSON file per session.
export function sessionFile(dir, sessionId) {
  return join(dir, 'sessions', `${(sessionId || 'no-session').replace(/[^\w-]/g, '_')}.json`)
}

export function loadSession(dir, sessionId) {
  return safe(() => JSON.parse(readFileSync(sessionFile(dir, sessionId), 'utf8'))) ?? { cache: {}, prefixes: {}, proposed: [], blockedPrompts: [] }
}

// Atomic: write beside, then rename, so two hooks racing (parallel tool calls) can
// lose an update but never leave a torn file. Session files older than SESSION_TTL
// are pruned on the way, one in ~20 writes.
export const SESSION_TTL = 7 * 24 * 3600 * 1000

export function saveSession(dir, sessionId, state, now = Date.now()) {
  safe(() => {
    const d = join(dir, 'sessions')
    mkdirSync(d, { recursive: true })
    const p = sessionFile(dir, sessionId)
    const tmp = `${p}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(state))
    renameSync(tmp, p)
    if (Math.random() < 0.05) pruneSessions(dir, now)
  })
}

export function pruneSessions(dir, now = Date.now()) {
  safe(() => {
    const d = join(dir, 'sessions')
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (now - statSync(p).mtimeMs > SESSION_TTL) unlinkSync(p)
    }
  })
}

export function cacheKey(gate, cwd, state) {
  return hash(`${gate}\n${cwd}\n${JSON.stringify(state)}`)
}

export function cacheGet(session, key, ttlMs, now = Date.now()) {
  const e = session.cache?.[key]
  if (!e) return null
  if (now - e.at > ttlMs) return null
  return e
}

export function cachePut(session, key, value, now = Date.now()) {
  session.cache ??= {}
  session.cache[key] = { ...value, at: now }
  // Keep the file bounded: drop the oldest beyond 500 entries.
  const keys = Object.keys(session.cache)
  if (keys.length > 500) for (const k of keys.sort((a, b) => session.cache[a].at - session.cache[b].at).slice(0, keys.length - 500)) delete session.cache[k]
}

// Promotion (HG-13): count confident, identical decisions per command prefix.
export function commandPrefix(command) {
  let s = String(command).trim()
  // Skip what is not the command: leading VAR=value assignments and `cd <dir> &&` /
  // `cd <dir>;` hops — 47% of real commands start with a cd, and a promotion rule for
  // "cd" would be meaningless.
  for (let guard = 0; guard < 8; guard++) {
    // `cd X && cmd`, `cd X; cmd` and `cd X⏎cmd` — the last is how most real commands
    // arrive (9,408 of 12,700 cd-led commands in one maintainer's transcripts).
    const next = s.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+)+/, '').replace(/^cd\s+(?:"[^"]*"|'[^']*'|\S+)[ \t]*(?:&&|;|\n)\s*/, '')
    if (next === s) break
    s = next
  }
  const words = s.split(/\s+/)
  const first = words[0] ?? ''
  const takesSub = ['git', 'npm', 'npx', 'pnpm', 'yarn', 'docker', 'kubectl', 'gh', 'cargo', 'go', 'make', 'python', 'python3', 'node', 'pip']
  return takesSub.includes(first) && words[1] && !words[1].startsWith('-') ? `${first} ${words[1]}` : first
}

export function notePrefix(session, prefix, decision, confidence, cfg) {
  if (!['allow', 'deny'].includes(decision) || confidence < cfg.promote.confidence) return null
  session.prefixes ??= {}
  session.proposed ??= []
  const p = (session.prefixes[prefix] ??= { allow: 0, deny: 0 })
  p[decision] += 1
  if (p[decision] >= cfg.promote.after && !session.proposed.includes(prefix)) {
    session.proposed.push(prefix)
    return { prefix, decision, count: p[decision] }
  }
  return null
}
