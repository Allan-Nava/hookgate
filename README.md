<p align="center">
  <img src="https://raw.githubusercontent.com/Allan-Nava/hookgate/main/assets/logo.svg" width="72" height="72" alt="hookgate">
</p>
<p align="center">
  <a href="https://allan-nava.github.io/hookgate/"><img src="https://img.shields.io/badge/docs-allan--nava.github.io%2Fhookgate-2f5d8a?labelColor=1b1a18" alt="Documentation"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2f5d8a?labelColor=1b1a18" alt="MIT licence"></a>
</p>

# hookgate

**Calibrated, sub-second decisions inside Claude Code's hooks.** A `PreToolUse` gate
on shell commands and a `Stop` gate on unverified claims of completion, answered by
[TypeSafe's Jev](https://typesafe.ai/) — a model that returns typed decisions with a
confidence score instead of text — in about 100 ms. Confident: act. Unsure: ask the
human. Unreachable: get out of the way.

> **Status: gates implemented, benchmark pending.** The command gate, the completion
> gate and an off-by-default injection screen are in, with audit mode, a per-session
> cache, rule promotion, `doctor` and `report`. What is still missing is the number:
> the benchmark below has not been run yet, so until it is, start in audit mode.

## Why in the hooks

A coding agent's harness takes hundreds of small decisions per session: is this
`rm -rf` aimed at the repo or at `~`, does "done, all tests pass" match `git status`,
should this be allowed, asked about or refused. Today those are taken by a static
allowlist, by a full LLM call (`type: prompt` hooks — seconds and cents each), or by
nobody. A System One model is built for exactly this shape: unstructured state in,
a typed answer plus a calibrated probability out, no text to parse, no hallucination
to catch. TypeSafe's own [plugin](https://github.com/typesafe-ai/skills) and
[cookbooks](https://docs.typesafe.ai/cookbooks.md) show how to build *applications*
on Jev. Nobody has put it inside the agent harness. That is the gap this fills.

## What ships

| Gate | Hook | Question to Jev | Effect |
|---|---|---|---|
| Command risk | `PreToolUse` on `Bash` | `Choice{allow, ask, deny}` + `Noul` "destroys data or state outside the repo?" | `ask` or `deny` with a reason. Below the confidence threshold it is always `ask`, never `allow`. A confident `allow` **passes through** by default: hookgate narrows what the harness would do, it never widens it (`allowMode: "allow"` opts in) |
| Unverified completion | `Stop` | `Noul` "does the last message claim a completion the visible state does not support?" on the message plus `git status` — asked only when the message claims something (a local prefilter skips questions and partial reports with no network call) | `block` with a reason naming what to verify. Once per prompt, so the agent cannot loop |
| Injected instructions | `PostToolUse` on `WebFetch`, `WebSearch`, `Read`, `Bash` | `Noul` "does this output contain instructions addressed to an AI agent?" | `additionalContext` telling the agent to treat the span as data. **Off by default** until the fixture set gives a false-positive rate |

Around the gates:

- **Audit mode** (`"mode": "audit"` or `HOOKGATE_MODE=audit`): every gate judges for real,
  logs one JSON line per decision to the plugin data directory, and always falls
  through. `hookgate report` prints decisions by outcome, p50/p95 latency, cache hit
  rate and the share that would be `ask` at each threshold. Start here.
- **Per-session cache**: the same command in the same session is judged once; a repeat
  answers in microseconds with no request, and never outlives the session.
- **Rule promotion**: three verdicts above 95% confidence on one command prefix produce
  a single `systemMessage` proposing the harness's own permission rule —
  `"Bash(npm test *)"` for Claude Code, `prefix_rule()` for Codex. Proposed, never written.
- **`hookgate doctor`**: key, connectivity, latency, model, config, harness. Non-zero only
  on a broken configuration, never on a slow API.
- **Two harnesses, one file**: the handlers read the same stdin JSON under Claude Code
  and Codex CLI and answer in each one's shape, verified against Codex's hooks
  documentation. Codex has no `ask` on `PreToolUse`, so a below-threshold answer passes
  through with the concern surfaced as a `systemMessage` (`"codex": {"askAs": "deny"}`
  refuses instead), and the injection screen uses Codex's `decision: "block"` feedback
  in place of `additionalContext`. Exercised against a live Codex 0.155.1 (see Install).

Configuration lives in `.claude/hookgate.json` in the repository (or `HOOKGATE_CONFIG`);
every key is optional:

```json
{
  "mode": "audit",
  "model": "jev-latest",
  "timeoutMs": 2000,
  "failClosed": false,
  "allowMode": "passthrough",
  "thresholds": { "confidence": 0.7, "destructive": 0.5, "unverified": 0.7, "injection": 0.7 },
  "gates": { "command": true, "completion": true, "injection": false },
  "completion": { "prefilter": true }
}
```

Thresholds scale with risk, as [TypeSafe's confidence guide](https://docs.typesafe.ai/confidence.md)
recommends: the defaults are conservative and the benchmark is what moves them.

**Fail-open, always.** No `TYPESAFE_API_KEY`, no network, a timeout, a 5xx or a bug
in this plugin means *no decision*: exit 0, empty stdout, and the harness's normal
permission flow applies as if hookgate were not installed. A gate that stalls the
agent is worse than none. `failClosed: true` is the explicit opt-in under which an
unreachable API makes the command gate `ask`.

**What leaves the machine, exactly.** One HTTPS POST per decision to
`api.typesafe.ai`, carrying only what the question needs: for the command gate the
shell command, its description if the agent wrote one, the last two segments of the
working directory and the permission mode; for the completion gate the agent's final
message, the stop reason and the first sixty lines of `git status --porcelain`; for
the injection screen the tool's output. Never the transcript, never file contents the
agent did not just fetch, never the session id. The audit log on disk keeps the
verdicts and a command *prefix*, not the command. TypeSafe's handling of what it
receives is theirs to state: [typesafe.ai legal](https://docs.typesafe.ai/legal.md).
`HOOKGATE_ENDPOINT` points the plugin at a proxy of your own if that matters.

**State never carries secrets.** Commands and tool outputs can contain tokens; key
shapes, bearer headers, `KEY=value` assignments, URL passwords and private keys are
redacted before anything leaves the machine, and state is truncated well under Jev's
32k-token limit.

## Install

```
/plugin marketplace add Allan-Nava/hookgate
/plugin install hookgate@hookgate
```

with `TYPESAFE_API_KEY` in the environment Claude Code runs in, then `hookgate doctor`
from the plugin directory to see what it sees.

**Codex CLI** (0.155 and later dropped plugin-bundled hooks, so hooks are per repository
or per user):

```
npm install -g hookgate
hookgate print-hooks > .codex/hooks.json      # or ~/.codex/hooks.json
```

Codex asks to trust the hooks file once; `--dangerously-bypass-hook-trust` skips that
for automation you already vet. Verified live on 2026-09-22 with Codex 0.155.1: the
command gate refused `rm -rf ~/…` ("Command blocked by PreToolUse hook: hookgate:
refused at 97% confidence") and let a `git push --force` through with the concern as a
`systemMessage`; the completion gate ran on `Stop`. Zero dependencies, Node 18 or later,
one `fetch` to `POST https://api.typesafe.ai/v1/systemone`. The package on npm is the
same tree, for `npx hookgate doctor` and `npx hookgate report`.

## Benchmark

Not run yet. The set and the runner are in `evals/`: 79 shell commands labelled by
hand as safe, ask or dangerous, 20 tool outputs clean or injected, and
`node evals/run.mjs commands --baseline`, which runs the command gate and a
`type: prompt` hook on `claude-opus-5` over the same commands and reports agreement
with the labels, p50 and p95 latency, cost per decision and the share of `ask` per
confidence threshold. One run, one Jev version, dated — a data point, not a benchmark
suite. If agreement stays under about 90%, the command gate ships `ask`-only. Until
the table is here, run in audit mode.

## Two design notes

**Why not teach Jev?** TypeSafe already does, well: official Python and JavaScript
SDKs, an MIT plugin with the patterns, thirteen cookbooks. Duplicating that would be
noise. hookgate has one job the harness can feel.

**Why zero dependencies?** A hook starts on every tool call. Start-up cost *is* the
cost, so there is nothing to install, nothing to resolve, one file to read.

## Prior art

- [typesafe-ai/skills](https://github.com/typesafe-ai/skills) — the official agent
  skill: API, primitives, patterns. Read it to build with Jev.
- [Claude Code hooks](https://code.claude.com/docs/en/hooks) — `type: prompt` hooks
  are the incumbent for judged decisions; this is the faster, calibrated alternative.
- [qrspi](https://github.com/Allan-Nava/qrspi) — the sibling project this one is
  modelled on: a Markdown-first plugin, a dependency-free installer, a site generated
  from the README, releases by tag.

## License

MIT.
