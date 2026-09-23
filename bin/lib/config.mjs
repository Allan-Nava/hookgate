// Configuration, in trust order: defaults, the user's own file (~/.hookgate.json),
// an explicit HOOKGATE_CONFIG, then the repository's file — which may only TIGHTEN
// what the trusted layers say (HG-27): a cloned repository must not be able to switch
// the gate off, put it in audit mode, or point it at a model that does not exist.
// Environment overrides come last. A malformed file is a diagnostic for `doctor`,
// never a reason to block — the gate falls back to the layer below.
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEFAULTS = Object.freeze({
  // enforce | audit — audit judges for real, logs, and always falls through. Audit is
  // the default until the benchmark (HG-4) has put a number behind the thresholds:
  // 0.1.0 flips it to enforce. `enforce` is one line in ~/.hookgate.json meanwhile.
  mode: 'audit',
  model: 'jev-latest', // or a pinned id the response reported, e.g. jev-1.13.0
  timeoutMs: 2000, // the handler's own fetch timeout; hooks.json allows 5 s
  failClosed: false, // true: an unreachable API means `ask` in enforce mode, never fall-through; audit still falls through (HG-9, HG-1 D3)
  allowMode: 'passthrough', // passthrough | allow — whether a confident `allow` widens permissions
  thresholds: {
    confidence: 0.7, // below this every answer is `ask`
    destructive: 0.5, // Noul probability that forces at least `ask`
    unverified: 0.7, // Noul probability that blocks a Stop
    injection: 0.7, // Noul probability that annotates a tool result
  },
  gates: { command: true, completion: true, injection: false },
  completion: { prefilter: true, lexicon: [] }, // prefilter: skip the Jev call when the final message claims nothing (brief, Q7); lexicon: extra regex sources on top of the built-in languages
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

// Which direction is "tighter", per field. A repository value that is not tighter
// than the trusted one is ignored and reported. Fields with no rule — model,
// timeoutMs, failClosed — cannot be set by a repository at all: a wrong model or a
// 1 ms timeout is a fail-open path dressed as configuration, and fail-closed turns
// every outage into a prompt on every command — a denial-of-service lever a cloned
// repository must not hold.
const num = (x) => typeof x === 'number' && Number.isFinite(x)
const TIGHTEN = {
  mode: (t, r) => r === 'enforce',
  allowMode: (t, r) => r === 'passthrough',
  'thresholds.confidence': (t, r) => num(r) && r >= t,
  'thresholds.destructive': (t, r) => num(r) && r <= t,
  'thresholds.unverified': (t, r) => num(r) && r <= t,
  'thresholds.injection': (t, r) => num(r) && r <= t,
  'gates.command': (t, r) => r === true,
  'gates.completion': (t, r) => r === true,
  'gates.injection': (t, r) => r === true,
  'completion.prefilter': (t, r) => r === false,
  'completion.lexicon': () => true, // more patterns → more Jev calls, never fewer
  'codex.askAs': (t, r) => r === 'deny',
  maxStateChars: (t, r) => num(r) && r <= t,
  'cache.ttlMs': (t, r) => num(r) && r <= t,
  'promote.after': (t, r) => num(r) && r >= t,
  'promote.confidence': (t, r) => num(r) && r >= t,
}

const get = (o, path) => path.split('.').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), o)
const set = (o, path, v) => {
  const ks = path.split('.')
  let cur = o
  for (const k of ks.slice(0, -1)) cur = cur[k] = { ...(cur[k] ?? {}) }
  cur[ks.at(-1)] = v
}

function tighten(trusted, repo, ignored, path) {
  const out = merge(trusted, {})
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v) && !(key in TIGHTEN)) {
        walk(v, key)
        continue
      }
      const t = get(trusted, key)
      const rule = TIGHTEN[key]
      if (JSON.stringify(v) === JSON.stringify(t)) continue
      if (!rule) ignored.push(`${path}: ${key} may not be set by a repository (kept ${JSON.stringify(t)})`)
      else if (!rule(t, v)) ignored.push(`${path}: ${key}=${JSON.stringify(v)} loosens ${JSON.stringify(t)} — ignored`)
      else set(out, key, key === 'completion.lexicon' ? [...(Array.isArray(t) ? t : t ? [t] : []), ...(Array.isArray(v) ? v : [v])] : v)
    }
  }
  walk(repo, '')
  return out
}

function readJson(path, problems) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return null
  }
  try {
    const v = JSON.parse(text)
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      problems.push(`${path}: the top level must be an object`)
      return {}
    }
    return v
  } catch (e) {
    problems.push(`${path}: ${e.message}`)
    return {}
  }
}

export const userConfigPath = (env = process.env) => env.HOOKGATE_USER_CONFIG ?? join(homedir(), '.hookgate.json')

export function loadConfig(cwd = process.cwd(), env = process.env) {
  const problems = []
  const ignored = []
  // Trusted layers: defaults, the user's file, an explicit path from the environment.
  const userPath = userConfigPath(env)
  let cfg = merge(DEFAULTS, readJson(userPath, problems) ?? {})
  let path
  if (env.HOOKGATE_CONFIG) {
    path = env.HOOKGATE_CONFIG
    cfg = merge(cfg, readJson(path, problems) ?? {})
  } else {
    // The repository's file: the first of these that exists, allowed only to tighten.
    const candidates = [join(cwd, '.hookgate.json'), join(cwd, '.claude', 'hookgate.json'), join(cwd, '.codex', 'hookgate.json')]
    path = candidates.find(existsSync) ?? candidates[1]
    const repo = readJson(path, problems)
    if (repo) cfg = tighten(cfg, repo, ignored, path)
  }
  if (env.HOOKGATE_MODE) cfg.mode = env.HOOKGATE_MODE
  if (env.HOOKGATE_MODEL) cfg.model = env.HOOKGATE_MODEL
  if (env.HOOKGATE_FAIL_CLOSED === '1') cfg.failClosed = true
  validate(cfg, problems)
  return { cfg, path, userPath, problems, ignored }
}

// Every value the handlers arithmetic on or branch on, checked once here (HG-29): a
// string where a number should be would otherwise flow into setTimeout and truncate
// unnoticed. A bad value is reported and the default takes its place — the gate keeps
// judging on numbers that mean something.
const RULES = {
  mode: (v) => ['enforce', 'audit'].includes(v) || 'enforce|audit',
  model: (v) => (typeof v === 'string' && v.trim().length > 0) || 'a non-empty string',
  timeoutMs: (v) => (num(v) && v >= 100 && v <= 10000) || 'a number of milliseconds in [100, 10000]',
  failClosed: (v) => typeof v === 'boolean' || 'true|false',
  allowMode: (v) => ['passthrough', 'allow'].includes(v) || 'passthrough|allow',
  'thresholds.confidence': (v) => (num(v) && v >= 0 && v <= 1) || 'a number in [0, 1]',
  'thresholds.destructive': (v) => (num(v) && v >= 0 && v <= 1) || 'a number in [0, 1]',
  'thresholds.unverified': (v) => (num(v) && v >= 0 && v <= 1) || 'a number in [0, 1]',
  'thresholds.injection': (v) => (num(v) && v >= 0 && v <= 1) || 'a number in [0, 1]',
  'gates.command': (v) => typeof v === 'boolean' || 'true|false',
  'gates.completion': (v) => typeof v === 'boolean' || 'true|false',
  'gates.injection': (v) => typeof v === 'boolean' || 'true|false',
  'completion.prefilter': (v) => typeof v === 'boolean' || 'true|false',
  'completion.lexicon': (v) => (Array.isArray(v) && v.every((x) => typeof x === 'string')) || typeof v === 'string' || 'a regex source or a list of them',
  'cache.ttlMs': (v) => (num(v) && v >= 0) || 'a number of milliseconds ≥ 0',
  'promote.after': (v) => (Number.isInteger(v) && v >= 1) || 'an integer ≥ 1',
  'promote.confidence': (v) => (num(v) && v >= 0 && v <= 1) || 'a number in [0, 1]',
  'codex.askAs': (v) => ['passthrough', 'deny'].includes(v) || 'passthrough|deny',
  maxStateChars: (v) => (Number.isInteger(v) && v >= 200 && v <= 100000) || 'an integer in [200, 100000]',
}

function validate(cfg, problems) {
  for (const [key, rule] of Object.entries(RULES)) {
    const v = get(cfg, key)
    const r = rule(v)
    if (r === true) continue
    problems.push(`${key} must be ${r}, got ${JSON.stringify(v)} — using ${JSON.stringify(get(DEFAULTS, key))}`)
    set(cfg, key, get(DEFAULTS, key))
  }
}
