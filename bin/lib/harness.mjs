// Two harnesses, one file. Claude Code and Codex CLI send the same stdin JSON and
// differ in the answer shape and in the environment variables a plugin gets.
import { homedir } from 'node:os'
import { join } from 'node:path'

export function detectHarness(env = process.env) {
  if (env.CLAUDE_PLUGIN_ROOT || env.CLAUDE_PROJECT_DIR || env.CLAUDECODE) return 'claude'
  if (env.PLUGIN_ROOT || env.CODEX_HOME) return 'codex'
  return 'claude'
}

export function dataDir(env = process.env) {
  return env.HOOKGATE_DATA ?? env.CLAUDE_PLUGIN_DATA ?? env.PLUGIN_DATA ?? join(homedir(), '.hookgate')
}

// The JSON a handler prints for a PreToolUse decision. `null` means fall through.
export function permissionOutput(harness, decision, reason, extra = {}) {
  if (!decision) return null
  if (harness === 'codex') {
    // Codex has no `ask` on PreToolUse: a below-threshold answer blocks with a reason
    // that tells the agent to ask the user, which is what `ask` means there.
    const block = decision !== 'allow'
    return { decision: block ? 'block' : 'allow', reason, systemMessage: block ? reason : undefined, ...extra }
  }
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason, ...extra } }
}

export function stopOutput(harness, reason) {
  if (harness === 'codex') return { decision: 'block', reason }
  return { decision: 'block', reason, hookSpecificOutput: { hookEventName: 'Stop' } }
}

export function postToolOutput(harness, context) {
  if (harness === 'codex') return { additionalContext: context }
  return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context } }
}

// A permission rule in the harness's own syntax, for promotion (HG-13).
export function ruleSyntax(harness, prefix, decision) {
  if (harness === 'codex') {
    const words = prefix.split(' ').map((w) => JSON.stringify(w)).join(', ')
    return `# .codex/rules/hookgate.rules\nprefix_rule(pattern = [${words}], decision = "${decision === 'allow' ? 'allow' : 'forbidden'}")`
  }
  return `// .claude/settings.json → permissions.${decision}\n"Bash(${prefix} *)"`
}
