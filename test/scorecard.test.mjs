// The scorecard must run on this checkout, name every open bug, and never score a
// fixed metric below 100% — a fix that lands must not break the metric that proves it.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { tmp } from './helpers.mjs'

const HERE = new URL('.', import.meta.url).pathname

test('scorecard runs without a key and scores every open bug', () => {
  const out = join(tmp(), 'head.json')
  const r = spawnSync(process.execPath, [join(HERE, '..', 'evals', 'scorecard.mjs'), '--json', out], { encoding: 'utf8', env: { PATH: process.env.PATH } })
  assert.equal(r.status, 0, r.stderr)
  const { metrics } = JSON.parse(readFileSync(out, 'utf8'))
  const ids = new Set(metrics.map((m) => m.id))
  for (const id of ['HG-23', 'HG-24', 'HG-25', 'HG-26', 'HG-27', 'HG-28', 'HG-29']) assert.ok(ids.has(id), `${id} has no metric`)
  for (const m of metrics) assert.ok(m.score === null || (m.score >= 0 && m.score <= 1), `${m.id}: ${m.score}`)
  // Fixtures the code already handles stay handled.
  assert.equal(metrics.find((m) => m.what.includes('recall on en')).score, 1)
  assert.equal(metrics.find((m) => m.what.includes('simple commands')).score, 1)
})

test('scorecard --compare fails on a regression and passes on an improvement', () => {
  const dir = tmp()
  const head = join(dir, 'head.json')
  const base = join(dir, 'base.json')
  const bin = join(HERE, '..', 'evals', 'scorecard.mjs')
  spawnSync(process.execPath, [bin, '--json', head], { env: { PATH: process.env.PATH } })
  const scores = JSON.parse(readFileSync(head, 'utf8'))
  // A base where one metric was better than it is now must fail the comparison.
  const better = { ...scores, metrics: scores.metrics.map((m) => (m.what.includes('skips en') ? { ...m, score: 1 } : m)) }
  writeFileSync(base, JSON.stringify(better))
  const r = spawnSync(process.execPath, [bin, '--compare', base], { encoding: 'utf8', env: { PATH: process.env.PATH } })
  assert.equal(r.status, 1, 'a metric below its base must fail')
  assert.match(r.stdout, /1 regressed/)
  // A base where every metric was worse passes and counts the improvements.
  const worse = { ...scores, metrics: scores.metrics.map((m) => ({ ...m, score: m.score === null ? null : 0 })) }
  writeFileSync(base, JSON.stringify(worse))
  const r2 = spawnSync(process.execPath, [bin, '--compare', base], { encoding: 'utf8', env: { PATH: process.env.PATH } })
  assert.equal(r2.status, 0, r2.stdout)
  assert.match(r2.stdout, /0 regressed/)
})
