// Two harnesses, one file. Claude Code and Codex CLI send the same stdin JSON and
// differ in the answer shape and in the environment variables a plugin gets.
import { homedir } from 'node:os'
import { join } from 'node:path'

// Order: an explicit HOOKGATE_HARNESS, then the plugin variables each harness sets,
// then the stdin shape — a repo-level hooks.json sets no plugin variable at all, and
// Codex's stdin carries `turn_id` and `model` where Claude Code carries `prompt_id`.
export function detectHarness(env = process.env, input = {}) {
  if (env.HOOKGATE_HARNESS === 'codex' || env.HOOKGATE_HARNESS === 'claude') return env.HOOKGATE_HARNESS
  if (env.CLAUDE_PLUGIN_ROOT || env.CLAUDE_PROJECT_DIR || env.CLAUDECODE) return 'claude'
  if (env.PLUGIN_ROOT || env.CODEX_HOME) return 'codex'
  if (input && input.turn_id && !input.prompt_id) return 'codex'
  return 'claude'
}

export function dataDir(env = process.env) {
  return env.HOOKGATE_DATA ?? env.CLAUDE_PLUGIN_DATA ?? env.PLUGIN_DATA ?? join(homedir(), '.hookgate')
}

// The JSON a handler prints for a PreToolUse decision. `null` means fall through.
export function permissionOutput(harness, decision, reason, extra = {}, { codexAskAs = 'passthrough' } = {}) {
  if (!decision) return null
  if (harness === 'codex') {
    // Codex (learn.chatgpt.com/docs/hooks, 2026-09-22) takes the same
    // hookSpecificOutput.permissionDecision shape but only allow|deny — no `ask`. A
    // below-threshold answer therefore passes through with the concern surfaced as a
    // systemMessage, unless codex.askAs is "deny": hookgate never widens, and turning
    // every `ask` into a refusal would narrow more than the judgement supports.
    if (decision === 'ask') return codexAskAs === 'deny' ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny' }, systemMessage: reason, ...extra } : { systemMessage: reason, ...extra }
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision }, ...(decision === 'deny' ? { systemMessage: reason } : {}), ...extra }
  }
  // systemMessage is a top-level field of the hook output, beside hookSpecificOutput.
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason }, ...extra }
}

// A message with no decision: the promotion proposal when the gate itself falls through.
export function messageOutput(harness, event, systemMessage) {
  if (harness === 'codex') return { systemMessage }
  return { hookSpecificOutput: { hookEventName: event }, systemMessage }
}

// Stop: the same `{decision: "block", reason}` on both harnesses.
export function stopOutput(harness, reason) {
  if (harness === 'codex') return { decision: 'block', reason }
  return { decision: 'block', reason, hookSpecificOutput: { hookEventName: 'Stop' } }
}

// PostToolUse: Claude Code has additionalContext; Codex has no such field and
// documents `decision: "block"` as "records feedback without undoing" — the reason
// reaches the model, the result stays. That is the annotation, in Codex's terms.
export function postToolOutput(harness, context) {
  if (harness === 'codex') return { decision: 'block', reason: context }
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
