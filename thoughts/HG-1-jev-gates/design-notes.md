# HG-1 — design notes, as implemented

Not QRSPI artifacts: the gates were implemented directly on 2026-09-22 from the brief,
and these are the decisions taken on the way, with their reasons, so the brief and the
code agree. HG-1 as a QRSPI run remains the maintainer's call.

- **Passthrough on allow.** A `PreToolUse` `allow` bypasses the harness's own prompt.
  The brief's `Choice{allow, ask, deny}` is kept as the question, but by default a
  confident `allow` emits *no decision*: hookgate only narrows. `allowMode: "allow"`
  opts in once the benchmark says the gate earns it.
- **Two questions per command, not one.** The Choice carries the verdict; a separate
  Noul on destruction outside the repo is the safety net that turns a confident
  `allow` into `ask` when the two disagree. Cheap: one call answers both.
- **Stop guard is double.** `stop_hook_active` from the harness plus a per-prompt
  marker in the session file, so a block can never loop the agent.
- **Cache is per session, keyed by gate + cwd + redacted state.** TTL one hour, capped
  at 500 entries, never shared across sessions: a decision about `rm -rf build/` in
  one repo says nothing about another.
- **Audit mode is a mode, not a flag on each gate.** Same requests, same thresholds,
  always fall through, everything logged. The log is the second data source for the
  benchmark and the only honest way to pick thresholds.
- **Promotion proposes, never writes.** Three verdicts ≥ 0.95 on one prefix produce one
  `systemMessage` in the detected harness's rule syntax, once per prefix per session.
- **Codex is an answer shape, not a fork.** Detection by `PLUGIN_ROOT`, `HOOKGATE_HARNESS`
  or the stdin shape; Codex has no `ask` on `PreToolUse`, so `ask` passes through with
  the concern as a `systemMessage` (`codex.askAs: deny` refuses instead) — the first
  cut turned `ask` into `block`, which narrowed more than the judgement supports.
  Verified live on 0.155.1, see below.
- **Errors are typed.** `JevError.code` ∈ no-key · timeout · http · malformed · network;
  every one ends in fall-through, `failClosed` turns all but `no-key` into `ask` on the
  command gate only.
- **HG-8 dropped by construction.** A hook cannot make a tool result smaller after the
  fact, only annotate or block it; a Noul about "worth keeping" would spend tokens to
  say tokens were wasted. Output hygiene belongs to the harness (`PreToolUse`
  `updatedInput` piping a verbose command through `head`, or truncation at the
  source), and hookgate's `PostToolUse` slot is spent on the one question that does
  earn it: injected instructions (HG-15).
- **Codex, live.** 2026-09-22, Codex 0.155.1, scratch repo, repo-level `.codex/hooks.json`,
  fake Jev on `HOOKGATE_ENDPOINT`. `git push --force origin main` → `ask` at 0.85 →
  passed through (failed on its own: no remote); `rm -rf ~/hookgate-nonexistent-dir` →
  `deny` at 0.97 → Codex: "Command blocked by PreToolUse hook: hookgate: refused at 97%
  confidence — 98% likely destructive or exfiltrating"; `Stop` → completion gate ran,
  passed. Harness detected from the stdin shape (`turn_id`, no `prompt_id`). Two
  surprises: `plugin_hooks` is a removed feature in this Codex, and repo hooks need
  trust — `print-hooks` and the README Install section come from that.
- **Stop prefilter (Q7).** Traced with the graph on 2026-09-22: the completion gate was
  asking Jev on every stop that passed the config, key, `stop_hook_active` and
  once-per-prompt guards — the brief's default assumption of a local prefilter was not
  implemented. Now `claimsCompletion()` gates the request on completion lexicon, a
  ticked task list or an "all tests" phrase; skipped stops are logged as
  `skipped:prefilter`, `completion.prefilter: false` turns it off. Gate 2's cost per
  decision in the benchmark is to be read with this in mind.
