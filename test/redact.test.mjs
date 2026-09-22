import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepare, redact, truncate } from '../bin/lib/redact.mjs'

test('redacts the token shapes a command line carries', () => {
  const s = 'curl -H "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345" https://x.io; export TYPESAFE_API_KEY=sk-live-ABCDEFGHIJKLMNOPQRST; git push https://user:hunter2secret@github.com/a/b; echo ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123 AKIAABCDEFGHIJKLMNOP'
  const r = redact(s)
  assert.ok(!r.includes('abcdefghijklmnopqrstuvwxyz012345'), 'bearer')
  assert.ok(!r.includes('sk-live-ABCDEFGHIJKLMNOPQRST'), 'sk key')
  assert.ok(!r.includes('hunter2secret'), 'url password')
  assert.ok(!r.includes('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123'), 'github token')
  assert.ok(!r.includes('AKIAABCDEFGHIJKLMNOP'), 'aws key id')
  assert.ok(r.includes('curl -H'), 'keeps the command shape')
})

test('leaves ordinary commands alone', () => {
  for (const c of ['npm test', 'git status', 'ls -la src/', 'grep -n "def main" app.py', 'docker compose up -d']) assert.equal(redact(c), c)
})

test('truncates from the middle and says so', () => {
  const t = truncate('a'.repeat(100), 40)
  assert.ok(t.length < 100 && t.includes('elided by hookgate'))
  assert.equal(truncate('short', 40), 'short')
  assert.ok(prepare('x'.repeat(50) + ' TOKEN=abcdefgh1234', 200).includes('TOKEN=<redacted>'))
})
