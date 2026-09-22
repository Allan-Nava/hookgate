# 00 · Questions — HG-1 Jev gates for Claude Code (and Codex) hooks


The default assumption is what makes this phase non-blocking: work can proceed
without waiting for answers, and the assumptions are on the record.

---

## Ticket

**ID:** HG-1
**Link:** https://github.com/Allan-Nava/hookgate/issues/2
**Title:** Jev gates for Claude Code (and Codex) hooks

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

---

## Questions

### Q1 · Does 0.1.0 emit `allow` at all — auto-approving commands the user's own settings would have prompted for — or only `ask|deny` until the benchmark clears ~90%?

- **Risk if unresolved:** a `PreToolUse` `allow` bypasses the permission prompt entirely; one false `allow` on a destructive command runs it with no human in the loop, which is the single worst outcome the plugin can produce. The ticket's "Done when" says `allow|ask|deny` but its "Open risks" says `ask`-only under 90% — and the benchmark does not exist before the code does, so the release order decides which it is. It also fixes the shipped default thresholds, which the ticket calls configurable without naming a number.
- **Default assumption:** the code emits all three; the shipped default config sets the `allow` threshold to a value only reachable once the benchmark has run (effectively `ask`-only), and the README table is what justifies lowering it. `deny` is emitted from 0.1.0 whenever `Noul` says "destroys state outside the repo" above threshold.
- **Answer:** _(to be filled — human)_

### Q2 · May a repo-committed `.claude/hookgate.json` loosen the gate, or only tighten it?

- **Risk if unresolved:** if a cloned repo's config can lower thresholds or add `allow` rules, cloning a hostile repo turns the safety gate into an auto-approver — the plugin becomes the attack surface. If it can only tighten, per-repo tuning of `allow` is impossible and every repo inherits the user-level floor.
- **Default assumption:** two layers. User-level config (`~/.claude/hookgate.json`) sets the floor and owns `--fail-closed`; a repo-level file may only raise thresholds and add `deny` patterns. Anything in the repo file that would loosen is ignored with a `permissionDecisionReason` saying so.
- **Answer:** _(to be filled — human)_

### Q3 · Who labels the ≥50 benchmark commands, by what rule is `ask` split from `dangerous`, and is the label about the command text alone or command plus `cwd`?

- **Risk if unresolved:** the agreement percentage — the number that decides whether `allow` ever ships (Q1) — is only as good as the labels. Without a written rule, `rm -rf build/` versus `rm -rf ~/` versus `git push --force` get labelled by mood, and the same maintainer disagrees with themselves a week later. If `cwd` is part of the truth, the benchmark harness has to supply it and Jev has to be sent it.
- **Default assumption:** the maintainer labels alone, with a one-paragraph rule written into `CONTRIBUTING.md` before labelling starts: `dangerous` = irreversible loss or exfiltration outside the repo (`rm` outside cwd, `curl … | sh`, credentials in flight, force-push to a shared branch); `ask` = reversible-but-consequential or needs the human's context (package installs, network writes, `git reset --hard`, anything with `sudo`); `safe` = read-only or repo-local and undoable. Labels are on the command string with a fixed synthetic `cwd` inside a git repo; a second labeller is welcome but not required for 0.1.0.
- **Answer:** _(to be filled — human)_

### Q4 · Is shipping every Bash command from every repo to a third-party API acceptable, and what exactly is redacted before it leaves?

- **Risk if unresolved:** the hook fires on every tool call in every repo the plugin is installed in. Commands carry hostnames, customer names, internal paths, and — despite redaction — tokens in shapes no regex anticipated. If the maintainer has repos where this is not acceptable, the plugin needs a per-repo off switch or the install becomes unusable there, and nobody discovers it until a command has already been sent.
- **Default assumption:** acceptable for the maintainer's own use; the README states plainly what is sent. Redaction: values that look like credentials (`sk-…`, `ghp_…`, `AKIA…`, `Bearer …`, `-p`/`--password`/`--token` arguments, any `KEY=`/`TOKEN=`/`SECRET=` assignment, base64-ish runs ≥ 20 chars) are replaced with `<redacted>`; `cwd` is sent as the repo basename, not the absolute path; the `last_assistant_message` is sent as-is after the same pass. No per-repo off switch in 0.1.0 beyond not installing the plugin — the `enabled: false` key in `.claude/hookgate.json` is a candidate if Q2 lands on "repo may tighten".
- **Answer:** _(to be filled — human)_

### Q5 · How many times may the `Stop` gate block in one turn before it lets Claude stop?

- **Risk if unresolved:** a `Stop` hook that returns `block` makes Claude continue and stop again; if Jev still says "unverified", it blocks again. The loop burns exactly the tokens the plugin exists to save, and a user watching it has no way out but killing the session. Whether the second block is a feature ("it really is not done") or a bug is a maintainer call.
- **Default assumption:** at most one block per stop sequence — when the incoming event carries `stop_hook_active: true`, exit 0 without calling Jev. The reason on the single block tells Claude what to verify, so the second attempt carries evidence.
- **Answer:** _(to be filled — human)_

### Q6 · What does "git state" mean for the `Stop` gate, and is the transcript ever read?

- **Risk if unresolved:** "plus git state" can mean anything from `git status --porcelain` to a diff of every changed file; the latter blows the 32k-token state cap and the 2 s budget on a large change, and running git at all fails in a `cwd` that is not a repo. Reading `transcript_path` would let the gate see whether tests actually ran — the honest definition of "verified" — but a long session's transcript is megabytes and turns a 100 ms gate into a seconds-long one.
- **Default assumption:** git state = dirty-file count and the list of changed paths from `git status --porcelain`, capped at 50 lines, empty (not an error) outside a repo. The transcript is not read in 0.1.0; "unverified" is judged from `last_assistant_message` alone plus that summary — a message that says "tests pass" while `git status` shows no test file touched and no evidence of a run is what `Noul` is asked about.
- **Answer:** _(to be filled — human)_

### Q7 · Does the `Stop` gate call Jev on every stop, or only when the last message claims completion?

- **Risk if unresolved:** most stops are questions to the user or partial reports. Calling Jev on each one adds latency and cost to every turn — visible, since Claude Code shows nothing until the hook returns — and risks blocking a message that never claimed to be finished. The benchmark's "cost per decision" for Gate 2 changes by an order of magnitude depending on this.
- **Default assumption:** a local prefilter first: if the message contains no completion language (done, complete, finished, implemented, fixed, passing, ready, "all tests") and no ticked task list, exit 0 without a network call. Only messages that pass the prefilter go to Jev.
- **Answer:** _(to be filled — human)_

### Q8 · How is the `type: prompt` / `claude-opus-5` reference run reproducibly over 50 commands?

- **Risk if unresolved:** a real `type: prompt` hook only fires inside an interactive Claude Code session; driving 50 commands through it by hand is neither reproducible nor something CI can re-run at every `jev-latest` version. If the benchmark instead calls the Messages API directly, the README has to say so or the "same set against a `type: prompt` hook" claim is untrue.
- **Default assumption:** the reference is the Messages API called with the exact prompt text a `type: prompt` hook would receive, same model, no thinking, one call per command; `CONTRIBUTING.md` names this a proxy and notes the harness's own prompt wrapper is not reproduced. Latency is measured from the same machine on the same day for both columns. The run costs real money and is done by the maintainer, not in CI.
- **Answer:** _(to be filled — human)_

### Q9 · Under `--fail-closed`, what does each gate return when the key is missing or the API is down — and does fail-closed apply to `Stop` at all?

- **Risk if unresolved:** fail-closed on `PreToolUse` has two readings (`ask` or `deny`), and the second makes Claude Code unusable the moment TypeSafe has an outage. Fail-closed on `Stop` means `block` on every stop while the API is down — Claude can never finish, which is a loop with no exit (see Q5). Whether a timeout counts as "API down" is implicit in the ticket but decides what a slow network does to every command.
- **Default assumption:** `--fail-closed` affects `PreToolUse` only and means `ask`, never `deny`; `Stop` is always fail-open. A timeout, a non-2xx response, and a malformed body are all "API down". The flag is honoured only from user-level config, not from the repo file (Q2).
- **Answer:** _(to be filled — human)_

### Q10 · How much Codex must exist in 0.1.0 for the "two harnesses, one file" claim — the output-shape switch only, or a committed `.codex-plugin/` too?

- **Risk if unresolved:** Codex hooks may still be experimental and lack `ask`; designing an abstraction for an API that changes before 0.2.0 either wastes the work or bends the Claude Code path around a guess. Too little, and 0.2.0 discovers the handler cannot be shared without a fork — the constraint the ticket rules out.
- **Default assumption:** 0.1.0 ships the environment detection (`CLAUDE_PLUGIN_ROOT` vs `PLUGIN_ROOT`) and one output-shaping function with a unit test per harness, and nothing else Codex-specific: no `.codex-plugin/` manifest, no second `hooks.json`, no Codex row in the README table. Research confirms the Codex event names and decision vocabulary before the adapter is designed.
- **Answer:** _(to be filled — human)_

---

## Out of scope

Things the ticket might suggest but that we are **not** doing in this task:

- Teaching Jev or its API — the official `typesafe@typesafe-ai` plugin and cookbooks do; the README points there.
- An SDK — the official Python and JavaScript ones exist; here, one `systemone()` function.
- `PostToolUse` for output hygiene — a hook cannot truncate a tool result; a candidate for later, with a measurement.
- Gating tools other than `Bash` (`Write`, `Edit`, MCP tools) — one tool, one gate, until the benchmark says the approach holds.
- The Codex adapter itself — 0.1.0 designs for it (Q10) and 0.2.0 ships it.
- Other harnesses (Cursor, Gemini CLI, OpenCode) — nothing in the design should preclude them, nothing in this task supports them.
- A local or offline classifier as fallback when the API is unreachable — fail-open is the fallback.
- Logging, telemetry, or a dashboard of decisions — no decision leaves the machine except the request to Jev; no history is kept.
- Learning from the user's overrides (auto-tuning thresholds, per-user allowlists) — thresholds are set by hand from the benchmark.
- Managing or rewriting the user's own `permissions.allow`/`deny` settings — hookgate sits beside them, not on top.
- A second labeller or inter-rater agreement on the benchmark set — welcome later, not a gate for 0.1.0 (Q3).
- The site — "from README later", as the ticket says.
- Windows-specific testing — the hook is `node <file>` and should run; nothing beyond CI on macOS/Linux is promised.

---

## Status

- [x] Questions generated
- [ ] Reviewed by a human
- [ ] Answers collected (or assumptions explicitly accepted)

> Next phase: **Research**. The ticket is **not** passed to Research — only the
> questions and their answers.
