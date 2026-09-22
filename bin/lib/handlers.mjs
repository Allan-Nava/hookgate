// The three handlers, as one orchestration around the pure pieces: read config,
// build the state, consult the cache, ask Jev, decide, log, remember, answer in the
// harness's shape. Every error path ends in `null` (fall through) unless failClosed.
import { execFileSync } from 'node:child_process'
import { loadConfig } from './config.mjs'
import { COMMAND_QUESTIONS, COMPLETION_QUESTION, INJECTION_QUESTION, claimsCompletion, commandState, completionState, decideCommand, decideCompletion, decideInjection, injectionState } from './gates.mjs'
import { dataDir, detectHarness, messageOutput, permissionOutput, postToolOutput, ruleSyntax, stopOutput } from './harness.mjs'
import { JevError, endpointFrom, systemone } from './jev.mjs'
import { appendDecision, cacheGet, cacheKey, cachePut, commandPrefix, loadSession, notePrefix, promotablePrefix, saveSession } from './store.mjs'

const INJECTION_TOOLS = new Set(['WebFetch', 'Read', 'Bash', 'WebSearch'])

function gitStatus(cwd) {
  try {
    return execFileSync('git', ['status', '--porcelain', '--branch'], { cwd, encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .slice(0, 60)
      .join('\n')
  } catch {
    return ''
  }
}

// One round trip with the cache in front of it. Returns {answers, model, latencyMs, cached}
// or throws JevError.
async function judge({ gate, state, questions, input, cfg, session, deps }) {
  const key = cacheKey(gate, input.cwd ?? '', state)
  const hit = cacheGet(session, key, cfg.cache.ttlMs, deps.now())
  if (hit) return { answers: hit.answers, model: hit.model, latencyMs: 0, cached: true }
  const res = await systemone({ state, questions, model: cfg.model, apiKey: deps.env.TYPESAFE_API_KEY, timeoutMs: cfg.timeoutMs, fetchImpl: deps.fetch, endpoint: endpointFrom(deps.env) })
  cachePut(session, key, { answers: res.answers, model: res.model }, deps.now())
  return { ...res, cached: false }
}

function log(dir, gate, input, cfg, extra) {
  appendDecision(dir, {
    at: new Date().toISOString(),
    gate,
    event: input.hook_event_name ?? null,
    session: input.session_id ?? null,
    tool: input.tool_name ?? null,
    mode: cfg.mode,
    ...extra,
  })
}

// Errors: fail-open by default; fail-closed turns an unreachable API into `ask`.
function onError(e, gate, harness, cfg, dir, input) {
  const code = e instanceof JevError ? e.code : 'exception'
  log(dir, gate, input, cfg, { outcome: 'error', error: code, message: e.message })
  if (code === 'no-key' || code === 'bad-key') return null
  if (cfg.failClosed && gate === 'command') return permissionOutput(harness, 'ask', `hookgate: could not reach Jev (${e.message}) and failClosed is on — asking instead of falling through.`, {}, { codexAskAs: cfg.codex?.askAs })
  return null
}

export async function preToolUse(input, deps = {}) {
  deps = { env: process.env, fetch: globalThis.fetch, now: Date.now, ...deps }
  const { cfg } = loadConfig(input.cwd ?? process.cwd(), deps.env)
  const harness = detectHarness(deps.env, input)
  const dir = dataDir(deps.env)
  if (!cfg.gates.command || input.tool_name !== 'Bash') return null
  if (!deps.env.TYPESAFE_API_KEY) return null
  const raw = String(input.tool_input?.command ?? '')
  // A command longer than the state cap would reach Jev with its middle elided, and
  // whatever sits there — a `rm -rf` after a screen of padding — would never be seen.
  // A partial judgement is not a judgement: the answer is `ask`, with no request
  // (HG-26). Audit mode logs it and falls through like everything else.
  if (raw.length > cfg.maxStateChars) {
    const reason = `hookgate: this command is ${raw.length.toLocaleString('en-US')} characters, above the ${cfg.maxStateChars.toLocaleString('en-US')} the gate can judge whole — a human should look rather than a judge that sees the head and the tail.`
    log(dir, 'command', input, cfg, { outcome: cfg.mode === 'audit' ? 'pass' : 'ask', skipped: 'too-long', chars: raw.length, latencyMs: 0, cached: false })
    return cfg.mode === 'audit' ? null : permissionOutput(harness, 'ask', reason, {}, { codexAskAs: cfg.codex?.askAs })
  }
  const state = commandState(input, cfg)
  const session = loadSession(dir, input.session_id)
  try {
    const res = await judge({ gate: 'command', state, questions: COMMAND_QUESTIONS, input, cfg, session, deps })
    const { decision, reason } = decideCommand(res.answers, cfg)
    const risk = res.answers.risk ?? {}
    const promotable = promotablePrefix(raw)
    const promoted = notePrefix(session, promotable, risk.choice, risk.confidence ?? 0, cfg)
    saveSession(dir, input.session_id, session)
    log(dir, 'command', input, cfg, { outcome: decision, choice: risk.choice, confidence: risk.confidence, destructive: res.answers.destructive?.noul, model: res.model, latencyMs: res.latencyMs, cached: res.cached, prefix: commandPrefix(raw), promotable })
    const extra = promoted ? { systemMessage: `hookgate: "${promoted.prefix}" has been judged ${promoted.decision} ${promoted.count} times at ≥${Math.round(cfg.promote.confidence * 100)}% confidence — a static rule would save the round trip:\n${ruleSyntax(harness, promoted.prefix, promoted.decision)}` } : {}
    if (cfg.mode === 'audit' || (decision === 'allow' && cfg.allowMode !== 'allow')) return promoted ? messageOutput(harness, 'PreToolUse', extra.systemMessage) : null
    return permissionOutput(harness, decision, reason, extra, { codexAskAs: cfg.codex?.askAs })
  } catch (e) {
    return onError(e, 'command', harness, cfg, dir, input)
  }
}

export async function stop(input, deps = {}) {
  deps = { env: process.env, fetch: globalThis.fetch, now: Date.now, gitStatus, ...deps }
  const { cfg } = loadConfig(input.cwd ?? process.cwd(), deps.env)
  const harness = detectHarness(deps.env, input)
  const dir = dataDir(deps.env)
  if (!cfg.gates.completion || !deps.env.TYPESAFE_API_KEY) return null
  // Never loop the agent: the harness marks a stop caused by a stop hook, and we
  // remember the prompt we already blocked once.
  if (input.stop_hook_active) return null
  const session = loadSession(dir, input.session_id)
  const promptKey = input.prompt_id ?? input.turn_id ?? `msg:${(input.last_assistant_message ?? '').slice(0, 80)}`
  if ((session.blockedPrompts ?? []).includes(promptKey)) return null
  // Local prefilter, no network: a message that claims nothing has nothing to verify.
  if (cfg.completion?.prefilter !== false && !claimsCompletion(input.last_assistant_message, cfg.completion?.lexicon)) {
    log(dir, 'completion', input, cfg, { outcome: 'skipped', skipped: 'prefilter', latencyMs: 0, cached: false })
    return null
  }
  const state = completionState(input, deps.gitStatus(input.cwd ?? process.cwd()), cfg)
  try {
    const res = await judge({ gate: 'completion', state, questions: COMPLETION_QUESTION, input, cfg, session, deps })
    const { decision, reason } = decideCompletion(res.answers, cfg)
    const a = res.answers.unverified ?? {}
    log(dir, 'completion', input, cfg, { outcome: decision ?? 'pass', unverified: a.noul, confidence: a.confidence, model: res.model, latencyMs: res.latencyMs, cached: res.cached })
    if (decision === 'block' && cfg.mode !== 'audit') {
      session.blockedPrompts = [...(session.blockedPrompts ?? []), promptKey].slice(-50)
      saveSession(dir, input.session_id, session)
      return stopOutput(harness, reason)
    }
    saveSession(dir, input.session_id, session)
    return null
  } catch (e) {
    return onError(e, 'completion', harness, cfg, dir, input)
  }
}

export async function postToolUse(input, deps = {}) {
  deps = { env: process.env, fetch: globalThis.fetch, now: Date.now, ...deps }
  const { cfg } = loadConfig(input.cwd ?? process.cwd(), deps.env)
  const harness = detectHarness(deps.env, input)
  const dir = dataDir(deps.env)
  if (!cfg.gates.injection || !INJECTION_TOOLS.has(input.tool_name) || !deps.env.TYPESAFE_API_KEY) return null
  const state = injectionState(input, cfg)
  if (!state.output || state.output.length < 40) return null
  const session = loadSession(dir, input.session_id)
  try {
    const res = await judge({ gate: 'injection', state, questions: INJECTION_QUESTION, input, cfg, session, deps })
    const { decision, reason } = decideInjection(res.answers, cfg)
    const a = res.answers.injected ?? {}
    saveSession(dir, input.session_id, session)
    log(dir, 'injection', input, cfg, { outcome: decision ?? 'pass', injected: a.noul, confidence: a.confidence, model: res.model, latencyMs: res.latencyMs, cached: res.cached })
    if (decision === 'annotate' && cfg.mode !== 'audit') return postToolOutput(harness, reason)
    return null
  } catch (e) {
    return onError(e, 'injection', harness, cfg, dir, input)
  }
}
