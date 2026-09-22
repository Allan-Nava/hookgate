#!/usr/bin/env node
// hookgate — calibrated decision gates for Claude Code hooks.
//
//   hookgate check            validate the manifests, hooks.json and this file
//   hookgate pre-tool-use     PreToolUse handler (reads the hook JSON on stdin)
//   hookgate stop             Stop handler (reads the hook JSON on stdin)
//   hookgate help
//
// Every handler FAILS OPEN. Exit 0 with no JSON on stdout means "no decision":
// Claude Code's ordinary permission flow applies, exactly as if the plugin were not
// installed. A missing TYPESAFE_API_KEY, a timeout, a 5xx or a bug in this file must
// never block the user's work. Fail-closed is an explicit opt-in for later.
//
// Zero dependencies, Node 18+: a hook starts on every tool call, so start-up cost
// is the cost. The API is one POST with fetch, which Node 18 has.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const json = (p) => JSON.parse(read(p))

const [cmd = 'help'] = process.argv.slice(2)

// --- hook handlers ----------------------------------------------------------
//
// Not implemented yet: the gates are being designed under thoughts/HG-1-jev-gates/
// through the QRSPI workflow. Until then both handlers fall through — the plugin is
// installable and inert, which is what fail-open means.

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
  if (!input || !process.env.TYPESAFE_API_KEY) process.exit(0)
  process.stderr.write(`hookgate: ${name} gate not implemented yet — falling through\n`)
  process.exit(0)
}

// --- check ------------------------------------------------------------------

const HOOK_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop', 'UserPromptSubmit', 'PermissionRequest'])

function check() {
  const errors = []
  const fail = (m) => errors.push(m)

  const pkg = json('package.json')
  const plugin = json('.claude-plugin/plugin.json')
  const market = json('.claude-plugin/marketplace.json')

  const versions = { 'package.json': pkg.version, 'plugin.json': plugin.version, 'marketplace.json': market.metadata?.version }
  if (new Set(Object.values(versions)).size !== 1) fail(`versions differ: ${JSON.stringify(versions)}`)
  if (pkg.name !== 'hookgate' || plugin.name !== 'hookgate') fail('package.json and plugin.json must both be named hookgate')
  if (!(market.plugins ?? []).some((p) => p.name === 'hookgate' && p.source === './')) fail('marketplace.json must list the hookgate plugin with source "./"')
  if (!/github\.com[/:]Allan-Nava\/hookgate/.test(pkg.repository?.url ?? '')) fail('package.json#repository must name the GitHub repo')
  if (pkg.dependencies && Object.keys(pkg.dependencies).length) fail('no runtime dependencies — a hook runs on every tool call')
  for (const f of ['bin', 'hooks', '.claude-plugin', 'README.md', 'LICENSE']) if (!pkg.files?.includes(f)) fail(`package.json#files is missing ${f}`)

  const hooks = json('hooks/hooks.json')
  for (const [event, entries] of Object.entries(hooks.hooks ?? {})) {
    if (!HOOK_EVENTS.has(event)) fail(`hooks.json: unknown event ${event}`)
    for (const entry of entries) {
      for (const h of entry.hooks ?? []) {
        if (h.type !== 'command') fail(`${event}: only command hooks are used here (got ${h.type})`)
        if (h.command !== '${CLAUDE_PLUGIN_ROOT}/bin/hookgate.mjs') fail(`${event}: command must be \${CLAUDE_PLUGIN_ROOT}/bin/hookgate.mjs, got ${h.command}`)
        if (!Array.isArray(h.args) || !['pre-tool-use', 'stop'].includes(h.args[0])) fail(`${event}: args must name a handler this file implements`)
        if (typeof h.timeout !== 'number' || h.timeout > 10) fail(`${event}: timeout must be set and at most 10 s — a gate that stalls the agent is worse than none`)
      }
    }
  }
  if (!hooks.hooks?.PreToolUse?.some((e) => e.matcher === 'Bash')) fail('hooks.json: the PreToolUse gate must match Bash')

  for (const f of ['README.md', 'CONTRIBUTING.md', 'CLAUDE.md', 'LICENSE']) if (!existsSync(join(ROOT, f))) fail(`${f} is missing`)
  if (!/fail-open|fails open/i.test(read('README.md'))) fail('README.md must state the fail-open rule')

  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`)
    process.exit(1)
  }
  const n = Object.values(hooks.hooks).reduce((a, es) => a + es.reduce((b, e) => b + e.hooks.length, 0), 0)
  console.log(`ok — ${n} hooks, manifests in sync at ${pkg.version}`)
}

function help() {
  console.log(read('bin/hookgate.mjs').split('\n').slice(1, 6).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'))
}

switch (cmd) {
  case 'check':
    check()
    break
  case 'pre-tool-use':
  case 'stop':
    await handler(cmd)
    break
  default:
    help()
}
