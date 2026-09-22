import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULTS } from '../bin/lib/config.mjs'
import { commandState, completionState, decideCommand, decideCompletion, decideInjection } from '../bin/lib/gates.mjs'

const cfg = DEFAULTS
const ans = (choice, confidence, noul = 0.05) => ({ risk: { type: 'choice', choice, confidence }, destructive: { type: 'noul', noul, confidence: 0.9 } })

test('confident allow is allow', () => assert.equal(decideCommand(ans('allow', 0.92), cfg).decision, 'allow'))
test('confident deny is deny', () => assert.equal(decideCommand(ans('deny', 0.95, 0.97), cfg).decision, 'deny'))
test('below the confidence threshold is always ask, never allow', () => {
  assert.equal(decideCommand(ans('allow', 0.69), cfg).decision, 'ask')
  assert.equal(decideCommand(ans('deny', 0.4), cfg).decision, 'ask')
})
test('a destructive signal forces at least ask on an allow', () => assert.equal(decideCommand(ans('allow', 0.9, 0.6), cfg).decision, 'ask'))
test('malformed answers decide nothing', () => {
  assert.equal(decideCommand({}, cfg).decision, null)
  assert.equal(decideCommand({ risk: { choice: 'maybe', confidence: 0.9 } }, cfg).decision, null)
})
test('thresholds are configurable', () => assert.equal(decideCommand(ans('allow', 0.75), { thresholds: { ...cfg.thresholds, confidence: 0.8 } }).decision, 'ask'))

test('completion blocks only when unverified AND confident', () => {
  assert.equal(decideCompletion({ unverified: { noul: 0.85, confidence: 0.8 } }, cfg).decision, 'block')
  assert.equal(decideCompletion({ unverified: { noul: 0.85, confidence: 0.5 } }, cfg).decision, null)
  assert.equal(decideCompletion({ unverified: { noul: 0.3, confidence: 0.9 } }, cfg).decision, null)
})
test('injection annotates above threshold', () => {
  assert.equal(decideInjection({ injected: { noul: 0.9, confidence: 0.9 } }, cfg).decision, 'annotate')
  assert.equal(decideInjection({ injected: { noul: 0.2, confidence: 0.9 } }, cfg).decision, null)
})

test('state is redacted and shaped', () => {
  const s = commandState({ tool_input: { command: 'curl -H "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123" x' }, cwd: '/Users/a/projects/repo' }, cfg)
  assert.ok(!s.command.includes('abcdefghijklmnopqrstuvwxyz0123'))
  assert.equal(s.working_directory, 'projects/repo')
  const c = completionState({ last_assistant_message: 'done', stop_reason: 'end_turn' }, ' M a.js', cfg)
  assert.equal(c.git_status_porcelain, ' M a.js')
})
