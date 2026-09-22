#!/usr/bin/env node
// Local benchmarks: no key, no network, nothing leaves the machine. Two sources:
//
//   1. this checkout — the fixed cost of the hook itself (process start, fall-through,
//      cache hit, a local fake Jev) as p50/p95 over N spawns;
//   2. Claude Code's own transcripts under ~/.claude/projects — counts only: how many
//      Stop messages the completion prefilter would skip, how often a shell command
//      repeats within a session (cache value), which prefixes dominate (promotion
//      value), how many commands carry something the redactor changes.
//
//   node evals/local.mjs                 both
//   node evals/local.mjs overhead        spawn timings only
//   node evals/local.mjs transcripts     transcript counts only
//   node evals/local.mjs --json          machine-readable to evals/results/
//
// Transcript figures are aggregates; no command text and no message text is stored.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { claimsCompletion } from '../bin/lib/gates.mjs'
import { redact } from '../bin/lib/redact.mjs'
import { promotablePrefix } from '../bin/lib/store.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const BIN = join(HERE, '..', 'bin', 'hookgate.mjs')
const argv = process.argv.slice(2)
const which = argv.find((a) => !a.startsWith('--')) ?? 'both'
const q = (xs, p) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] : null)
const pct = (x) => `${Math.round(x * 100)}%`

// --- 1. overhead -------------------------------------------------------------

async function overhead(n = 30) {
  const out = {}
  const time = (label, env, input) => {
    const t = []
    for (let i = 0; i < n; i++) {
      const t0 = process.hrtime.bigint()
      spawnSync(process.execPath, [BIN, 'pre-tool-use'], { input: JSON.stringify(input), env, encoding: 'utf8' })
      t.push(Number(process.hrtime.bigint() - t0) / 1e6)
    }
    out[label] = { p50: q(t, 0.5), p95: q(t, 0.95), n }
  }
  const input = { hook_event_name: 'PreToolUse', session_id: 'bench', tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: '/tmp' }
  const base = { PATH: process.env.PATH }
  time('no key (fall-through)', base, input)
  // A local fake Jev in its own process: spawnSync below blocks this process's event
  // loop, and a server living here could not answer (the numbers would be the timeout).
  const fake = spawn(process.execPath, ['-e', `
    const { createServer } = require('node:http')
    const answers = { risk: { choice: 'allow', confidence: 0.95 }, destructive: { noul: 0.01, confidence: 0.9 } }
    createServer((req, res) => { req.on('data', () => {}); req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ model: 'jev-fake', answers, usage: { input_tokens: 100, output_tokens: 0 } })) }) })
      .listen(0, '127.0.0.1', function () { process.stdout.write(String(this.address().port) + '\\n') })
  `], { stdio: ['ignore', 'pipe', 'inherit'] })
  const port = await new Promise((r) => fake.stdout.once('data', (d) => r(String(d).trim())))
  const data = mkdtempSync(join(tmpdir(), 'hookgate-bench-'))
  const withKey = { ...base, TYPESAFE_API_KEY: 'sk-bench-0123456789abcdef', HOOKGATE_ENDPOINT: `http://127.0.0.1:${port}`, HOOKGATE_DATA: data, CLAUDE_PLUGIN_ROOT: '/plugin' }
  // first call fills the cache; subsequent identical calls hit it — measure both
  spawnSync(process.execPath, [BIN, 'pre-tool-use'], { input: JSON.stringify(input), env: withKey })
  time('cache hit (no request)', withKey, input)
  let i = 0
  const t = []
  for (; i < n; i++) {
    const t0 = process.hrtime.bigint()
    spawnSync(process.execPath, [BIN, 'pre-tool-use'], { input: JSON.stringify({ ...input, tool_input: { command: `npm test -- --grep case${i}` } }), env: withKey, encoding: 'utf8' })
    t.push(Number(process.hrtime.bigint() - t0) / 1e6)
  }
  out['local fake Jev (full round trip, no network)'] = { p50: q(t, 0.5), p95: q(t, 0.95), n }
  fake.kill()
  return out
}

// --- 2. transcripts ----------------------------------------------------------

function* transcriptFiles(root) {
  if (!existsSync(root)) return
  for (const proj of readdirSync(root)) {
    const d = join(root, proj)
    if (!statSync(d).isDirectory()) continue
    for (const f of readdirSync(d)) if (f.endsWith('.jsonl')) yield join(d, f)
  }
}

function transcripts() {
  const root = join(homedir(), '.claude', 'projects')
  let sessions = 0
  let commands = 0
  let repeats = 0
  let redacted = 0
  let promotable = 0
  let stops = 0
  let stopsClaiming = 0
  const prefixes = new Map()
  const perSessionRepeatRates = []
  for (const file of transcriptFiles(root)) {
    let lines
    try {
      lines = readFileSync(file, 'utf8').split('\n')
    } catch {
      continue
    }
    const seen = new Map()
    let n = 0
    let rep = 0
    let lastAssistantText = null
    let lastRole = null
    for (const line of lines) {
      if (!line) continue
      let e
      try {
        e = JSON.parse(line)
      } catch {
        continue
      }
      const msg = e.message
      if (!msg || !Array.isArray(msg.content)) continue
      if (e.type === 'assistant') {
        for (const c of msg.content) {
          if (c.type === 'tool_use' && c.name === 'Bash' && typeof c.input?.command === 'string') {
            const cmd = c.input.command
            n++
            const k = cmd.trim()
            seen.set(k, (seen.get(k) ?? 0) + 1)
            if (seen.get(k) > 1) rep++
            if (redact(cmd) !== cmd) redacted++
            const p = promotablePrefix(cmd)
            if (p) promotable++
            prefixes.set(p ?? '(not promotable)', (prefixes.get(p ?? '(not promotable)') ?? 0) + 1)
          }
          if (c.type === 'text' && c.text) lastAssistantText = c.text
        }
        lastRole = 'assistant'
      } else if (e.type === 'user') {
        // a user turn after an assistant text = the assistant had stopped: that text is
        // what the Stop hook would have seen as last_assistant_message
        const humanTurn = msg.content.some((c) => c.type === 'text')
        if (humanTurn && lastRole === 'assistant' && lastAssistantText) {
          stops++
          if (claimsCompletion(lastAssistantText)) stopsClaiming++
        }
        lastRole = 'user'
      }
    }
    if (n) {
      sessions++
      commands += n
      repeats += rep
      perSessionRepeatRates.push(rep / n)
    }
  }
  const top = [...prefixes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  return { sessions, commands, repeats, repeatRate: commands ? repeats / commands : 0, medianSessionRepeatRate: q(perSessionRepeatRates, 0.5), redacted, redactedRate: commands ? redacted / commands : 0, promotable, promotableRate: commands ? promotable / commands : 0, stops, stopsClaiming, prefilterSkipRate: stops ? 1 - stopsClaiming / stops : 0, topPrefixes: top }
}

// --- main --------------------------------------------------------------------

const result = { at: new Date().toISOString() }
if (which !== 'transcripts') result.overhead = await overhead()
if (which !== 'overhead') result.transcripts = transcripts()

const lines = []
if (result.overhead) {
  lines.push('## Hook overhead (this machine, 30 spawns each)', '', '| Case | p50 | p95 |', '|---|---:|---:|')
  for (const [k, v] of Object.entries(result.overhead)) lines.push(`| ${k} | ${v.p50.toFixed(0)} ms | ${v.p95.toFixed(0)} ms |`)
  lines.push('')
}
if (result.transcripts) {
  const t = result.transcripts
  lines.push(`## From ${t.sessions} local Claude Code sessions (counts only)`, '')
  lines.push(`- Shell commands: ${t.commands}. Exact repeats within a session: ${t.repeats} (${pct(t.repeatRate)}; median session ${pct(t.medianSessionRepeatRate ?? 0)}) — the cache's ceiling.`)
  lines.push(`- Commands the redactor would change: ${t.redacted} (${pct(t.redactedRate)}).`)
  lines.push(`- Stops (assistant text followed by a human turn): ${t.stops}. Claiming completion: ${t.stopsClaiming}. The prefilter skips ${pct(t.prefilterSkipRate)} of Jev calls on the completion gate.`)
  lines.push(`- Commands a promoted rule may cover (one simple command, no interpreter): ${t.promotable} (${pct(t.promotableRate)}). Top: ${t.topPrefixes.filter(([p]) => p !== '(not promotable)').map(([p, c]) => `\`${p}\` ${c}`).join(' · ')}.`)
  lines.push('')
}
console.log(lines.join('\n'))
if (argv.includes('--json')) {
  mkdirSync(join(HERE, 'results'), { recursive: true })
  const f = join(HERE, 'results', `${result.at.slice(0, 10)}-local.json`)
  writeFileSync(f, JSON.stringify(result, null, 2))
  console.log(`written ${f}`)
}
