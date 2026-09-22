// Configuration: defaults, then `.claude/hookgate.json` (or HOOKGATE_CONFIG) in the
// working directory, then environment overrides. A malformed file is a diagnostic
// for `doctor`, never a reason to block — the gate falls back to the defaults.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const DEFAULTS = Object.freeze({
  mode: 'enforce', // enforce | audit — audit judges for real, logs, and always falls through
  model: 'jev-latest', // or a pinned id the response reported, e.g. jev-1.13.0
  timeoutMs: 2000, // the handler's own fetch timeout; hooks.json allows 5 s
  failClosed: false, // true: an unreachable API means `ask`, never fall-through (HG-9)
  allowMode: 'passthrough', // passthrough | allow — whether a confident `allow` widens permissions
  thresholds: {
    confidence: 0.7, // below this every answer is `ask`
    destructive: 0.5, // Noul probability that forces at least `ask`
    unverified: 0.7, // Noul probability that blocks a Stop
    injection: 0.7, // Noul probability that annotates a tool result
  },
  gates: { command: true, completion: true, injection: false },
  cache: { ttlMs: 60 * 60 * 1000 },
  promote: { after: 3, confidence: 0.95 },
  codex: { askAs: 'passthrough' }, // passthrough | deny — Codex has no `ask` on PreToolUse
  maxStateChars: 12000, // well under Jev's 32k-token state limit
})

const merge = (a, b) => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b ?? {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] ?? {}, v) : v
  return out
}

export function loadConfig(cwd = process.cwd(), env = process.env) {
  const problems = []
  const path = env.HOOKGATE_CONFIG ?? join(cwd, '.claude', 'hookgate.json')
  let file = {}
  if (existsSync(path)) {
    try {
      file = JSON.parse(readFileSync(path, 'utf8'))
    } catch (e) {
      problems.push(`${path}: ${e.message}`)
    }
  }
  const cfg = merge(DEFAULTS, file)
  if (env.HOOKGATE_MODE) cfg.mode = env.HOOKGATE_MODE
  if (env.HOOKGATE_MODEL) cfg.model = env.HOOKGATE_MODEL
  if (env.HOOKGATE_FAIL_CLOSED === '1') cfg.failClosed = true
  if (!['enforce', 'audit'].includes(cfg.mode)) {
    problems.push(`mode must be enforce|audit, got "${cfg.mode}" — using enforce`)
    cfg.mode = 'enforce'
  }
  if (!['passthrough', 'allow'].includes(cfg.allowMode)) {
    problems.push(`allowMode must be passthrough|allow, got "${cfg.allowMode}" — using passthrough`)
    cfg.allowMode = 'passthrough'
  }
  for (const [k, v] of Object.entries(cfg.thresholds)) if (typeof v !== 'number' || v < 0 || v > 1) problems.push(`thresholds.${k} must be a number in [0, 1]`)
  return { cfg, path, problems }
}
