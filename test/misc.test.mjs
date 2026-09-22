import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { DEFAULTS, loadConfig } from '../bin/lib/config.mjs'
import { doctor } from '../bin/lib/doctor.mjs'
import { detectHarness, permissionOutput, ruleSyntax } from '../bin/lib/harness.mjs'
import { render, summarize } from '../bin/lib/report.mjs'
import { commandPrefix } from '../bin/lib/store.mjs'
import { fakeFetch, tmp } from './helpers.mjs'

test('config: defaults, file, env, and a malformed file is a problem not a failure', () => {
  const d = tmp()
  mkdirSync(join(d, '.claude'))
  writeFileSync(join(d, '.claude', 'hookgate.json'), '{"thresholds":{"confidence":0.8},"mode":"audit"}')
  const { cfg, problems } = loadConfig(d, {})
  assert.equal(cfg.thresholds.confidence, 0.8)
  assert.equal(cfg.thresholds.destructive, DEFAULTS.thresholds.destructive)
  assert.equal(cfg.mode, 'audit')
  assert.deepEqual(problems, [])
  assert.equal(loadConfig(d, { HOOKGATE_MODE: 'enforce' }).cfg.mode, 'enforce')
  writeFileSync(join(d, '.claude', 'hookgate.json'), '{not json')
  const bad = loadConfig(d, {})
  assert.equal(bad.cfg.mode, 'enforce')
  assert.equal(bad.problems.length, 1)
})

test('harness detection and shapes', () => {
  assert.equal(detectHarness({ CLAUDE_PLUGIN_ROOT: '/x' }), 'claude')
  assert.equal(detectHarness({ PLUGIN_ROOT: '/x' }), 'codex')
  assert.equal(detectHarness({}), 'claude')
  assert.equal(permissionOutput('claude', null, 'r'), null)
  assert.equal(permissionOutput('codex', 'allow', 'r').decision, 'allow')
  assert.match(ruleSyntax('codex', 'npm test', 'allow'), /prefix_rule/)
  assert.match(ruleSyntax('claude', 'git push', 'deny'), /"Bash\(git push \*\)"/)
})

test('command prefixes take the subcommand for the tools that have one', () => {
  assert.equal(commandPrefix('git push --force origin main'), 'git push')
  assert.equal(commandPrefix('npm test'), 'npm test')
  assert.equal(commandPrefix('rm -rf /'), 'rm')
  assert.equal(commandPrefix('ls'), 'ls')
})

test('report aggregates the audit log', () => {
  const s = summarize([
    { gate: 'command', outcome: 'allow', confidence: 0.9, latencyMs: 120, cached: false, model: 'jev-1.13.0' },
    { gate: 'command', outcome: 'ask', confidence: 0.6, latencyMs: 300, cached: false, model: 'jev-1.13.0' },
    { gate: 'command', outcome: 'ask', confidence: 0.6, cached: true, model: 'jev-1.13.0' },
    { gate: 'completion', outcome: 'block', confidence: 0.8, latencyMs: 200 },
  ])
  assert.equal(s.command.total, 3)
  assert.equal(s.command.outcomes.ask, 2)
  assert.equal(s.command.p50, 300)
  assert.ok(Math.abs(s.command.cacheHitRate - 1 / 3) < 1e-9)
  assert.equal(s.command.askShareAt[0.7], 2 / 3)
  assert.match(render(s), /command — 3 decisions/)
  assert.equal(render({}), 'no decisions logged yet')
})

test('doctor: no key is a warning, a broken config is BAD, a reachable API is ok', async () => {
  const d = tmp()
  let r = await doctor({ cwd: d, env: { HOOKGATE_DATA: d } })
  assert.equal(r.broken, false)
  assert.ok(r.lines.some((l) => /warn.*TYPESAFE_API_KEY/.test(l)))
  mkdirSync(join(d, '.claude'))
  writeFileSync(join(d, '.claude', 'hookgate.json'), '{nope')
  r = await doctor({ cwd: d, env: { HOOKGATE_DATA: d } })
  assert.equal(r.broken, true)
  writeFileSync(join(d, '.claude', 'hookgate.json'), '{}')
  r = await doctor({ cwd: d, env: { HOOKGATE_DATA: d, TYPESAFE_API_KEY: 'k' }, fetchImpl: fakeFetch({ alive: { noul: 1, confidence: 1 } }) })
  assert.ok(r.lines.some((l) => /api: answered in/.test(l)))
  assert.equal(r.broken, false)
})

test('a non-ASCII key is a bad-key error, not an opaque fetch failure', async () => {
  const { systemone } = await import('../bin/lib/jev.mjs')
  await assert.rejects(systemone({ state: 'x', questions: {}, model: 'jev-latest', apiKey: 'sk-…', timeoutMs: 100, fetchImpl: fakeFetch({}) }), (e) => e.code === 'bad-key')
  const r = await doctor({ cwd: tmp(), env: { HOOKGATE_DATA: tmp(), TYPESAFE_API_KEY: 'sk-…' } })
  assert.equal(r.broken, true)
})
