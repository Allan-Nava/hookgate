# hookgate

**Calibrated, sub-second decisions inside Claude Code's hooks.** A `PreToolUse` gate
on shell commands and a `Stop` gate on unverified claims of completion, answered by
[TypeSafe's Jev](https://typesafe.ai/) — a model that returns typed decisions with a
confidence score instead of text — in about 100 ms. Confident: act. Unsure: ask the
human. Unreachable: get out of the way.

> **Status: scaffold.** The plugin installs and does nothing yet. The two gates are
> being designed in `thoughts/HG-1-jev-gates/` through the
> [QRSPI](https://github.com/Allan-Nava/qrspi) workflow; the first release ships them
> with the benchmark below filled in. Until then every handler falls through.

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
| Command risk | `PreToolUse` on `Bash` | `Choice{allow, ask, deny}` + `Noul` "destroys data or state outside the repo?" | `permissionDecision` with a reason; below the confidence threshold it is always `ask`, never `allow` |
| Unverified completion | `Stop` | `Noul` "does the last message claim a completion the visible state does not support?" on the message plus `git status` | `block` with the reason, so the agent verifies before stopping |

Thresholds live in `.claude/hookgate.json` and scale with risk, as
[TypeSafe's confidence guide](https://docs.typesafe.ai/confidence.md) recommends.

**Fail-open, always.** No `TYPESAFE_API_KEY`, no network, a timeout, a 5xx or a bug
in this plugin means *no decision*: exit 0, empty stdout, and Claude Code's normal
permission flow applies as if hookgate were not installed. A gate that stalls the
agent is worse than none. Fail-closed will be an explicit opt-in.

**State never carries secrets.** Commands can contain tokens; anything that looks
like one is redacted before it leaves the machine, and state is truncated to Jev's
32k-token limit.

## Install

Not published yet. Once it is:

```
/plugin marketplace add Allan-Nava/hookgate
/plugin install hookgate@hookgate
```

and `TYPESAFE_API_KEY` in the environment Claude Code runs in. Zero dependencies,
Node 18 or later, one `fetch` to `POST https://api.typesafe.ai/v1/systemone`.

## Benchmark

The first release carries, in `evals/`, at least fifty shell commands labelled by
hand as safe, ask or dangerous, run against both gates and against a `type: prompt`
hook on `claude-opus-5`, and reports agreement with the labels, p50 and p95 latency,
cost per decision and the share of `ask` per confidence threshold. One run, one
model version, dated — a data point, not a benchmark suite. If agreement stays under
about 90%, the command gate ships `ask`-only.

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
