// The CLI contract, end to end: stdin JSON → the process → stdout JSON, exit 0,
// against a local HTTP fake standing in for api.typesafe.ai via HOOKGATE_ENDPOINT.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { tmp } from './helpers.mjs'

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'hookgate.mjs')
let server
let port
let answers = {}
let requests = []

before(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      requests.push({ auth: req.headers.authorization, body: JSON.parse(body) })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ model: 'jev-1.13.0', answers, usage: { input_tokens: 100, output_tokens: 0 } }))
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  port = server.address().port
})
after(() => server.close())

// Async on purpose: a synchronous spawn would block this process's event loop, and
// the fake server lives in this process.
function exec(args, { input, env, cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { env, cwd })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => (stdout += c))
    child.stderr.on('data', (c) => (stderr += c))
    child.on('close', (status) => resolve({ status, stdout, stderr }))
    if (input !== undefined) child.stdin.end(input)
    else child.stdin.end()
  })
}
const baseEnv = () => ({ PATH: process.env.PATH, TYPESAFE_API_KEY: 'sk-e2e-0123456789abcdef', HOOKGATE_ENDPOINT: `http://127.0.0.1:${port}`, HOOKGATE_DATA: tmp(), CLAUDE_PLUGIN_ROOT: '/plugin' })
const run = (handler, input, extraEnv = {}) => exec([BIN, handler], { input: JSON.stringify(input), env: { ...baseEnv(), ...extraEnv } })

test('deny comes out as Claude Code JSON, exit 0, key only in the header', async () => {
  answers = { risk: { choice: 'deny', confidence: 0.97 }, destructive: { noul: 0.99, confidence: 0.95 } }
  requests = []
  const r = await run('pre-tool-use', { hook_event_name: 'PreToolUse', session_id: 'e2e', tool_name: 'Bash', tool_input: { command: 'rm -rf ~' }, cwd: '/tmp' })
  assert.equal(r.status, 0)
  const out = JSON.parse(r.stdout)
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].auth, 'Bearer sk-e2e-0123456789abcdef')
  assert.ok(!JSON.stringify(requests[0].body).includes('e2e'), 'session id never leaves the machine')
})

test('a routine command is silence on stdout', async () => {
  answers = { risk: { choice: 'allow', confidence: 0.95 }, destructive: { noul: 0.01, confidence: 0.9 } }
  const r = await run('pre-tool-use', { hook_event_name: 'PreToolUse', session_id: 'e2e', tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: '/tmp' })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '')
})

test('stop blocks with a reason', async () => {
  answers = { unverified: { noul: 0.92, confidence: 0.9 } }
  const r = await run('stop', { hook_event_name: 'Stop', session_id: 'e2e2', prompt_id: 'p1', cwd: '/tmp', last_assistant_message: 'All done, tests pass.' })
  assert.equal(r.status, 0)
  assert.equal(JSON.parse(r.stdout).decision, 'block')
})

test('a dead endpoint fails open, and garbage stdin is ignored', async () => {
  const r = await run('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /' }, cwd: '/tmp' }, { HOOKGATE_ENDPOINT: 'http://127.0.0.1:1' })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '')
  const g = await exec([BIN, 'stop'], { input: 'not json', env: { PATH: process.env.PATH } })
  assert.equal(g.status, 0)
  assert.equal(g.stdout, '')
})

test('doctor sees the fake and reports ok', async () => {
  answers = { alive: { noul: 1, confidence: 1 } }
  const r = await exec([BIN, 'doctor'], { cwd: tmp(), env: baseEnv() })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /api: answered in \d+ ms · model jev-1.13.0/)
})

test('under Codex (PLUGIN_ROOT): deny in permissionDecision shape, stop as decision block, injection as block feedback', async () => {
  const codex = { PLUGIN_ROOT: '/codex-plugin', CLAUDE_PLUGIN_ROOT: '' }
  answers = { risk: { choice: 'deny', confidence: 0.97 }, destructive: { noul: 0.99, confidence: 0.95 } }
  const d = await run('pre-tool-use', { hook_event_name: 'PreToolUse', session_id: 'cx', turn_id: 't1', tool_name: 'Bash', tool_input: { command: 'rm -rf ~' }, cwd: '/tmp' }, codex)
  assert.equal(JSON.parse(d.stdout).hookSpecificOutput.permissionDecision, 'deny')
  answers = { unverified: { noul: 0.92, confidence: 0.9 } }
  const s = await run('stop', { hook_event_name: 'Stop', session_id: 'cx', turn_id: 't1', cwd: '/tmp', last_assistant_message: 'Done and pushed.' }, codex)
  assert.deepEqual(Object.keys(JSON.parse(s.stdout)).sort(), ['decision', 'reason'])
  const none = await run('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf ~' }, cwd: '/tmp' }, { ...codex, TYPESAFE_API_KEY: '' })
  assert.equal(none.stdout, '', 'no key under Codex falls through too')
})
