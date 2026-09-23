// Two harnesses, one file. Claude Code and Codex CLI send the same stdin JSON and
// differ in the answer shape and in the environment variables a plugin gets.
import { homedir } from 'node:os'
import { join } from 'node:path'

// Which signal decided, in the order tried. The hook's own signals come first: an
// explicit HOOKGATE_HARNESS, then the plugin root each harness sets for this very
// process, then the stdin shape — the event itself, so a repo-level hooks.json that
// sets no plugin variable is still recognised (Codex's stdin carries `turn_id` and
// `model` where Claude Code carries `prompt_id`). Only then the ambient variables:
// CLAUDECODE and CLAUDE_PROJECT_DIR outlive the shell that set them, so a Codex hook
// launched from a terminal opened inside Claude Code inherits them and must not be
// answered in Claude Code's shape. `signal` is one of 'HOOKGATE_HARNESS',
// 'CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT', 'stdin', 'CLAUDECODE', 'CLAUDE_PROJECT_DIR',
// 'CODEX_HOME', 'default'.
export function detectHarnessSignal(env = process.env, input = {}) {
  if (env.HOOKGATE_HARNESS === 'codex' || env.HOOKGATE_HARNESS === 'claude') return { harness: env.HOOKGATE_HARNESS, signal: 'HOOKGATE_HARNESS' }
  if (env.CLAUDE_PLUGIN_ROOT) return { harness: 'claude', signal: 'CLAUDE_PLUGIN_ROOT' }
  if (env.PLUGIN_ROOT) return { harness: 'codex', signal: 'PLUGIN_ROOT' }
  if (input && input.turn_id && !input.prompt_id) return { harness: 'codex', signal: 'stdin' }
  if (input && input.prompt_id && !input.turn_id) return { harness: 'claude', signal: 'stdin' }
  if (env.CLAUDECODE) return { harness: 'claude', signal: 'CLAUDECODE' }
  if (env.CLAUDE_PROJECT_DIR) return { harness: 'claude', signal: 'CLAUDE_PROJECT_DIR' }
  if (env.CODEX_HOME) return { harness: 'codex', signal: 'CODEX_HOME' }
  return { harness: 'claude', signal: 'default' }
}

export function detectHarness(env = process.env, input = {}) {
  return detectHarnessSignal(env, input).harness
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
