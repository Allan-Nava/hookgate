# HG-1 — Jev in Claude Code's gates

Brief from an interview on 2026-09-22; the input to the Questions phase.

**Goal.** The small, frequent decisions of the Claude Code harness — "is this
command risky?", "is the work really finished?" — are taken by Jev in ~100 ms with
calibrated confidence, instead of by an LLM (`type: prompt` hooks: seconds and cents
each) or by nobody.

**Done when.**
- `claude plugin install hookgate@hookgate` in any repo: a `PreToolUse` on `Bash`
  returns `allow|ask|deny` with a `permissionDecisionReason`; a `Stop` returns
  `block` with a reason when the last message declares finished work that is not.
  Missing `TYPESAFE_API_KEY` or API down → exit 0, no decision: the gate never
  blocks for its own sake (fail-open; `--fail-closed` opt-in).
- Reproducible benchmark in `evals/`: ≥50 hand-labelled shell commands (safe / ask /
  dangerous), the same set against a `type: prompt` hook on `claude-opus-5`. The
  README table reports agreement with the labels, p50/p95 latency, cost per
  decision, and the `ask` share per confidence threshold.
- `npm test` validates manifests, `hooks.json`, versions; CI on Node 18/20/22/24
  without `npm install`; release by tag as in qrspi.

**In scope.**
- Two harnesses, one file. Claude Code ships in 0.1.0; Codex CLI in 0.2.0, but the
  design accounts for both from the start: the handler reads the same stdin JSON
  (`hook_event_name`, `tool_name`, `tool_input`, `cwd`) on both and emits the
  harness's own answer shape — `hookSpecificOutput.permissionDecision` for Claude
  Code, `decision: allow|block` for Codex — chosen from the environment
  (`CLAUDE_PLUGIN_ROOT` vs `PLUGIN_ROOT`). Two manifests (`.claude-plugin/`,
  `.codex-plugin/`), two `hooks.json`, no forked logic.
- Claude Code plugin: `hooks/hooks.json` plus one Node ESM file, zero dependencies,
  raw `fetch` to `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`
  with an optional pin to the version the response reports.
- Gate 1, `PreToolUse/Bash`: `Choice{allow, ask, deny}` + `Noul` "destroys data or
  state outside the repo?" — thresholds configurable in `.claude/hookgate.json`;
  below threshold the answer is always `ask`, never `allow`.
- Gate 2, `Stop`: `Noul` "does the last message claim an unverified completion?" on
  `last_assistant_message` plus git state; `block` with the reason.
- README, CONTRIBUTING with the benchmark protocol; site from README later.

**Out of scope.**
- Teaching Jev or its API: the official plugin `typesafe@typesafe-ai` (MIT, 1,652
  stars) and the cookbooks do. The README points there.
- An SDK: the official Python and JavaScript ones exist. Here, one `systemone()`.
- `PostToolUse` for output hygiene: a hook cannot truncate a tool result, only add
  context or block. A candidate for later, with a measurement.

**Constraints.**
- State ≤ 32k tokens: truncate commands and messages; redact secret-looking values
  before sending (a command can carry a token).
- Latency: 2 s budget per hook with an explicit timeout; Jev promises 70–500 ms.
- The name uses neither "Jev" nor "TypeSafe": their marks.

**Decisions taken.**
- Gates in the harness, not a library for apps — because that is the gap: TypeSafe
  covers apps.
- New public repo, npm, the same operating model as qrspi — because qrspi stays
  Markdown-only and does not tie its thesis to a vendor.
- Zero dependencies, native `fetch` — because a hook starts on every tool call and
  must cost nothing at start-up; Node 18 has `fetch`.
- Name `hookgate` — free on npm and GitHub on 2026-09-22, describes the thing.

**Assumptions.** (unanswered; proceeding this way unless corrected)
- The comparison is against `type: prompt` with `claude-opus-5`, not against a
  human → if that is not the reference wanted, the benchmark column changes.
- MIT licence, as qrspi and the official skill.

**Open risks.**
- Codex hooks are documented but may still be marked experimental, and Codex has no
  `ask` decision on `PreToolUse` — the `PermissionRequest` event may be where "ask"
  lives. Research settles both before the adapter is designed.
- Jev's calibration on shell-command risk is unmeasured by anyone. If agreement with
  the labels is under ~90% on the set, the command gate stays `ask`-only.
- `jev-latest` can change its answers without notice: the benchmark is re-run at
  every version the response reports.
