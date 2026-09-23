// `hookgate doctor`: why is nothing happening? Non-zero only on a broken
// configuration, never on a slow or unreachable API — the gate fails open, so does
// its diagnosis.
import { existsSync } from 'node:fs'
import { loadConfig } from './config.mjs'
import { dataDir, detectHarnessSignal } from './harness.mjs'
import { endpointFrom, systemone } from './jev.mjs'

export async function doctor({ cwd = process.cwd(), env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const lines = []
  let broken = false
  const ok = (m) => lines.push(`  ok    ${m}`)
  const warn = (m) => lines.push(`  warn  ${m}`)
  const bad = (m) => {
    lines.push(`  BAD   ${m}`)
    broken = true
  }

  const { harness, signal } = detectHarnessSignal(env, {})
  ok(`harness: ${harness} (decided by ${signal === 'default' ? 'default — no harness signal in the environment, running outside a hook' : signal})`)
  ok(`data dir: ${dataDir(env)}`)
  if (env.HOOKGATE_ENDPOINT) warn(`endpoint overridden: ${env.HOOKGATE_ENDPOINT}`)

  const { cfg, path, userPath, problems, ignored } = loadConfig(cwd, env)
  ok(existsSync(userPath) ? `user config: ${userPath}` : `user config: none (${userPath})`)
  if (env.HOOKGATE_CONFIG) {
    warn('repository config skipped: HOOKGATE_CONFIG is set')
    if (existsSync(path)) ok(`config: ${path}`)
    else warn(`config: ${path} does not exist (HOOKGATE_CONFIG)`)
  } else if (existsSync(path)) ok(`${env.HOOKGATE_CONFIG ? 'config' : 'repository config (may only tighten)'}: ${path}`)
  else ok(`repository config: none (${path})`)
  for (const p of problems) bad(`config: ${p}`)
  for (const i of ignored) warn(`config: ${i}`)
  ok(`mode ${cfg.mode} · allowMode ${cfg.allowMode} · failClosed ${cfg.failClosed} · gates ${Object.entries(cfg.gates).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}`)
  ok(`thresholds: confidence ${cfg.thresholds.confidence} · destructive ${cfg.thresholds.destructive} · unverified ${cfg.thresholds.unverified} · injection ${cfg.thresholds.injection}`)

  if (!env.TYPESAFE_API_KEY) {
    warn('TYPESAFE_API_KEY is not set — every gate falls through')
    return { lines, broken }
  }
  if (!/^[\x21-\x7e]+$/.test(env.TYPESAFE_API_KEY)) {
    bad('TYPESAFE_API_KEY contains whitespace or non-ASCII characters — a placeholder pasted instead of the key?')
    return { lines, broken }
  }
  ok(`TYPESAFE_API_KEY set (${env.TYPESAFE_API_KEY.length} chars)`)
  try {
    const res = await systemone({
      state: 'hookgate doctor',
      questions: { alive: { type: 'noul', instructions: 'Is this a diagnostic ping?' } },
      model: cfg.model,
      apiKey: env.TYPESAFE_API_KEY,
      timeoutMs: Math.max(cfg.timeoutMs, 5000),
      fetchImpl,
      endpoint: endpointFrom(env),
    })
    ok(`api: answered in ${res.latencyMs} ms · model ${res.model} · usage ${JSON.stringify(res.usage)}`)
    if (res.latencyMs > cfg.timeoutMs) warn(`that is above the handler timeout of ${cfg.timeoutMs} ms — gates would have fallen through`)
  } catch (e) {
    warn(`api: ${e.message} — gates fall through${cfg.failClosed ? ', except the command gate, which asks (failClosed)' : ''}`)
  }
  return { lines, broken }
}
