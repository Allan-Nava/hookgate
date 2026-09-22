#!/usr/bin/env node
// hookgate — calibrated decision gates for Claude Code (and Codex CLI) hooks.
//
//   hookgate check            validate the manifests, hooks files and this package
//   hookgate pre-tool-use     PreToolUse handler: the command-risk gate (stdin JSON)
//   hookgate stop             Stop handler: the completion gate (stdin JSON)
//   hookgate post-tool-use    PostToolUse handler: the injection screen (stdin JSON, off by default)
//   hookgate doctor           key, connectivity, latency, model, config, harness
//   hookgate report           decisions by outcome, latency, ask share — from the audit log
//   hookgate print-hooks      a .codex/hooks.json for this checkout, absolute paths (Codex
//                             0.155 dropped plugin-bundled hooks; repo or user hooks remain)
//   hookgate help
//
// Every handler FAILS OPEN. Exit 0 with no JSON on stdout means "no decision": the
// harness's ordinary permission flow applies, exactly as if the plugin were not
// installed. A missing TYPESAFE_API_KEY, a timeout, a 5xx or a bug in this file must
// never block the user's work. Fail-closed is an explicit opt-in (`failClosed: true`).
//
// Zero dependencies, Node 18+: a hook starts on every tool call, so start-up cost is
// the cost. The API is one POST with fetch, which Node 18 has.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const json = (p) => JSON.parse(read(p))
const [cmd = 'help'] = process.argv.slice(2)

async function readStdin() {
  let s = ''
  for await (const chunk of process.stdin) s += chunk
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

async function handler(name) {
  const input = await readStdin()
  if (!input) process.exit(0)
  try {
    const { preToolUse, stop, postToolUse } = await import('./lib/handlers.mjs')
    const fn = { 'pre-tool-use': preToolUse, stop, 'post-tool-use': postToolUse }[name]
    const out = await fn(input)
    if (out) process.stdout.write(`${JSON.stringify(out)}\n`)
  } catch (e) {
    // The last line of defence: a bug here is a debug-log line, not a blocked agent.
    process.stderr.write(`hookgate: ${name} failed open: ${e.message}\n`)
  }
  process.exit(0)
}

const HOOK_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop', 'UserPromptSubmit', 'PermissionRequest'])
const HANDLERS = new Set(['pre-tool-use', 'stop', 'post-tool-use'])

function checkHooksFile(path, rootVar, fail) {
  const hooks = json(path)
  for (const [event, entries] of Object.entries(hooks.hooks ?? {})) {
    if (!HOOK_EVENTS.has(event)) fail(`${path}: unknown event ${event}`)
    for (const entry of entries) {
      for (const h of entry.hooks ?? []) {
        if (h.type !== 'command') fail(`${path} ${event}: only command hooks are used here (got ${h.type})`)
        // Claude Code takes command + args; Codex documents a single command string.
        const handler = Array.isArray(h.args) ? h.args[0] : h.command.split(/\s+/).at(-1)
        const bin = Array.isArray(h.args) ? h.command : h.command.replace(/^node\s+"?/, '').replace(/"?\s+\S+$/, '')
        if (bin !== `${rootVar}/bin/hookgate.mjs`) fail(`${path} ${event}: command must run ${rootVar}/bin/hookgate.mjs, got ${h.command}`)
        if (!HANDLERS.has(handler)) fail(`${path} ${event}: the command must end in a handler this file implements, got ${handler}`)
        if (typeof h.timeout !== 'number' || h.timeout > 10) fail(`${path} ${event}: timeout must be set and at most 10 s — a gate that stalls the agent is worse than none`)
      }
    }
  }
  if (!hooks.hooks?.PreToolUse?.some((e) => e.matcher === 'Bash')) fail(`${path}: the PreToolUse gate must match Bash`)
  if (!hooks.hooks?.Stop) fail(`${path}: the Stop gate is missing`)
  return hooks
}

function check() {
  const errors = []
  const fail = (m) => errors.push(m)
  const pkg = json('package.json')
  const plugin = json('.claude-plugin/plugin.json')
  const market = json('.claude-plugin/marketplace.json')
  const codex = json('.codex-plugin/plugin.json')

  const versions = { 'package.json': pkg.version, 'plugin.json': plugin.version, 'marketplace.json': market.metadata?.version, 'codex plugin.json': codex.version }
  if (new Set(Object.values(versions)).size !== 1) fail(`versions differ: ${JSON.stringify(versions)}`)
  if (pkg.name !== 'hookgate' || plugin.name !== 'hookgate' || codex.name !== 'hookgate') fail('package.json, plugin.json and .codex-plugin/plugin.json must all be named hookgate')
  if (!(market.plugins ?? []).some((p) => p.name === 'hookgate' && p.source === './')) fail('marketplace.json must list the hookgate plugin with source "./"')
  if (!/^(?:git\+)?https:\/\/github\.com\/Allan-Nava\/hookgate(?:\.git)?$/.test(pkg.repository?.url ?? '')) fail('package.json#repository must be the GitHub repo URL, exactly')
  if (pkg.dependencies && Object.keys(pkg.dependencies).length) fail('no runtime dependencies — a hook runs on every tool call')
  for (const f of ['bin', 'hooks', 'codex', '.claude-plugin', '.codex-plugin', 'README.md', 'CHANGELOG.md', 'LICENSE']) if (!pkg.files?.includes(f)) fail(`package.json#files is missing ${f}`)

  const claude = checkHooksFile('hooks/hooks.json', '${CLAUDE_PLUGIN_ROOT}', fail)
  const codexHooks = checkHooksFile('codex/hooks.json', '${PLUGIN_ROOT}', fail)
  const handlersOf = (h) => Object.values(h.hooks).flatMap((es) => es.flatMap((e) => e.hooks.map((x) => (Array.isArray(x.args) ? x.args[0] : x.command.split(/\s+/).at(-1))))).sort().join(',')
  if (handlersOf(claude) !== handlersOf(codexHooks)) fail('hooks/hooks.json and codex/hooks.json must register the same handlers')

  for (const f of ['README.md', 'CONTRIBUTING.md', 'CLAUDE.md', 'LICENSE', 'BACKLOG.md', 'ROADMAP.md', 'CHANGELOG.md']) if (!existsSync(join(ROOT, f))) fail(`${f} is missing`)
  if (existsSync(join(ROOT, 'CHANGELOG.md'))) {
    const log = read('CHANGELOG.md')
    if (!/^## \[Unreleased\]/m.test(log)) fail('CHANGELOG.md needs an [Unreleased] section — the release bump renames it')
    if (!log.includes(`## [${pkg.version}]`) && pkg.version !== '0.0.0') fail(`CHANGELOG.md has no section for ${pkg.version}`)
  }
  if (!/what leaves the machine/i.test(read('README.md'))) fail('README.md must state what leaves the machine')
  if (!/fail-open|fails open/i.test(read('README.md'))) fail('README.md must state the fail-open rule')
  for (const m of ['bin/lib/config.mjs', 'bin/lib/gates.mjs', 'bin/lib/handlers.mjs', 'bin/lib/harness.mjs', 'bin/lib/jev.mjs', 'bin/lib/redact.mjs', 'bin/lib/store.mjs', 'bin/lib/report.mjs', 'bin/lib/doctor.mjs']) if (!existsSync(join(ROOT, m))) fail(`${m} is missing`)

  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`)
    process.exit(1)
  }
  const n = Object.values(claude.hooks).reduce((a, es) => a + es.reduce((b, e) => b + e.hooks.length, 0), 0)
  console.log(`ok — ${n} hooks, two harnesses, manifests in sync at ${pkg.version}`)
}

function help() {
  console.log(read('bin/hookgate.mjs').split('\n').slice(1, 10).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'))
}

switch (cmd) {
  case 'check':
    check()
    break
  case 'pre-tool-use':
  case 'stop':
  case 'post-tool-use':
    await handler(cmd)
    break
  case 'doctor': {
    const { doctor } = await import('./lib/doctor.mjs')
    const { lines, broken } = await doctor()
    console.log(`hookgate doctor\n${lines.join('\n')}`)
    process.exit(broken ? 1 : 0)
    break
  }
  case 'print-hooks': {
    const tpl = json('codex/hooks.json')
    const bin = join(ROOT, 'bin', 'hookgate.mjs')
    for (const entries of Object.values(tpl.hooks)) for (const e of entries) for (const h of e.hooks) h.command = h.command.replace('${PLUGIN_ROOT}/bin/hookgate.mjs', bin)
    tpl.description = `hookgate — calibrated gates for Codex CLI, pointing at ${bin}. Save as .codex/hooks.json in the repository (or ~/.codex/hooks.json) and trust it when Codex asks.`
    console.log(JSON.stringify(tpl, null, 2))
    break
  }
  case 'report': {
    const { report } = await import('./lib/report.mjs')
    const { dataDir } = await import('./lib/harness.mjs')
    console.log(report(dataDir()))
    break
  }
  default:
    help()
}
