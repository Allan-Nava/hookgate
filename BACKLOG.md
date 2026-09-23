# Backlog — hookgate

Single source of truth for what is planned. Items keep a stable `HG-n` id so
commits, the CHANGELOG, the `thoughts/` artifacts and the issues can reference them.
New ideas go here rather than into scattered TODO comments.

[ROADMAP.md](ROADMAP.md) is a **generated** view of this file, grouped by milestone.
Do not edit it by hand — run `node scripts/backlog.mjs roadmap` after touching this
file, or CI fails. The GitHub issues are another generated view: on every push to
`main` that changes this file, `.github/workflows/backlog-issues.yml` opens, retitles,
closes and reopens issues to match it. The sync runs one way only. Closing an issue
on GitHub changes nothing; ticking the item here does.

## How to write an item

```
## v0.2.0 — Title of the milestone <!-- ms: phase=next -->

- [ ] **HG-99 — Short name**: what it is, why it earns its place, what it needs to
  touch. <!-- hg: prio=high size=M labels=gate -->
```

- The **id never changes**. A new item takes the next free number, never a retired
  one. Moving an item to another milestone is fine; renumbering it is not.
- `- [ ]` is open, `- [x]` is shipped, and a shipped item says where it went:
  `ver=0.1.0`, or `ver=main` when it is merged but not yet released. An item closed
  *without* shipping — decided against, superseded — is ticked with `ver=dropped` and
  its body says why, so the id and the reasoning stay on record and the issue closes.
- Metadata is a trailing `<!-- hg: ... -->` comment: `prio` (`high|med|low`), `size`
  (`S|M|L|XL`), `labels` (comma-separated, from the vocabulary below), `ver`
  (shipped items only).
- A milestone heading is the GitHub milestone's exact title, `vX.Y.Z — Theme`, with a
  trailing `<!-- ms: phase=now|next|later|shipped -->`. `release.yml` closes the
  GitHub milestone whose title starts with the version it tags.
- Labels: `gate` (a hook gate), `benchmark` (measurement and evals), `release`
  (publishing and versioning), `docs` (README, CONTRIBUTING, site), `project`
  (backlog, roadmap, repo hygiene), `tests`, `enhancement`.

## v0.1.0 — Two gates, one benchmark <!-- ms: phase=now -->

The first release: both gates decided by Jev with calibrated confidence, fail-open,
and the reproducible benchmark the README promises. Designed through QRSPI under
`thoughts/HG-1-jev-gates/`.

**The benchmark is the gate on this milestone.** Nothing ships as `enforce` by
default (`0.0.3` ships audit by default for exactly this reason), no threshold moves,
and no `hookgate--v0.1.0` is tagged before HG-4 has run and its table is in the README: the gates decide on a calibration nobody has
measured yet, and a plugin that says `deny` to a developer had better have a number
behind it. The code and the labelled sets are in place; the run needs a TypeSafe API
key, which is not available as of 2026-09-22 — the milestone waits for it, and audit
mode is the only recommended mode until then.

- [x] **HG-1 — Run QRSPI on the brief: Questions → Research → Spec → Plan**: the
  design work for the first release, one fresh session per phase, input
  `thoughts/HG-1-jev-gates/00-brief.md`. Done when `00` to `04` are ticked and the
  plan passes the zero-context test; its steps become the pull requests for HG-2,
  HG-3 and HG-4. Rule 4: the brief does not enter Research. Run 2026-09-23, after
  the gates had shipped: each phase a fresh subagent reading only its artifact.
  Research found ten places where code, answers and docs disagree (two safety
  bugs: a repository file could set `failClosed`; fail-closed `ask` fired in audit
  mode); a targeted round settled six open facts by reading the raw hook
  references and one live Codex probe; Design fixed 0.1.0 as a corrective release
  with a pre-stated decision table for the default mode; Structure gives 11 steps,
  Plan 568 lines that pass the zero-context test. The maintainer's boxes in `01`
  and `02` (reviewed, approved) are still theirs to tick. Implementation is HG-32.
  <!-- hg: prio=high size=L labels=gate,enhancement ver=main -->
- [x] **HG-2 — Command-risk gate: PreToolUse on Bash answered by Jev**: one
  `Choice{allow, ask, deny}` and one `Noul` on a redacted, truncated state; below
  the confidence threshold the decision is `ask`, never `allow`; thresholds in
  `.claude/hookgate.json`; a unit test per fail-open path, runnable without a key.
  <!-- hg: prio=high size=L labels=gate ver=0.0.3 -->
- [x] **HG-3 — Completion gate: Stop hook that blocks unverified claims of done**:
  one `Noul` on `last_assistant_message` plus a capped `git status`; `block` with a
  reason that names what to verify; at most one block per stop so the agent cannot
  loop. <!-- hg: prio=high size=M labels=gate ver=0.0.3 -->
- [ ] **HG-32 — Implement the HG-1 plan, steps S1–S6, S8**: from
  `thoughts/HG-1-jev-gates/04-plan.md`, one pull request per step or per parallel
  chain: `failClosed` leaves the repository-tightenable set (S1, design D2); audit
  mode never decides, not even on error (S2, D3); `detectHarness` reordered so the
  stdin shape beats the inherited `CLAUDECODE`, with the deciding signal exposed and
  shown by `doctor` (S3–S4, D5); the D4 decision table and the Stop smoke-check
  runbook in CONTRIBUTING (S5); the docs reconciliation (S6, D8); the live Stop
  smoke check against Claude Code with a fake Jev (S8, human). S7 (full `claude -p`
  baseline, ≈$10, human) is HG-4's first half; S9–S11 are HG-4 and HG-5.
  <!-- hg: prio=high size=L labels=gate,tests -->
- [ ] **HG-4 — Benchmark: ≥50 labelled commands, Jev gate vs type: prompt hook**:
  `evals/commands.jsonl` (79, labelled by hand) and `evals/run.mjs` are in place;
  the run reports agreement, p50/p95 latency, cost per decision, `ask` share per
  threshold; one dated run with the Jev version the responses reported. Under ~90%
  agreement the command gate ships `ask`-only. **Fundamental: gates the release and
  every default beyond `ask`.** Blocked on a TypeSafe API key since 2026-09-22.
  <!-- hg: prio=high size=M labels=benchmark -->
- [ ] **HG-5 — First release 0.1.0: trusted publisher, tag, publish**: the bootstrap
  is done (`hookgate@0.0.2` is on npm; `0.0.3` was the first release over the trusted
  publisher, HG-31); what remains is HG-4, the default back to `enforce`, and the tag —
  **after HG-4**, not before. <!-- hg: prio=med size=S labels=release -->
- [x] **HG-6 — Site generated from README, as qrspi does it**: `site/build.mjs`
  ported with the gates index read off `hooks/hooks.json`, logo, social preview,
  Pages workflow. <!-- hg: prio=low size=S labels=docs ver=0.0.3 -->
- [x] **HG-7 — Backlog as the single source of truth, enforced by CI**: this file,
  `scripts/backlog.mjs` (lint, roadmap, check, issues), the generated ROADMAP.md,
  the one-way issue sync on push to `main`, and the `backlog` CI job.
  <!-- hg: prio=med size=M labels=project ver=0.0.3 -->
- [x] **HG-10 — Audit mode: log every decision and its confidence without
  enforcing**: `HOOKGATE_MODE=audit` runs both gates for real but always falls
  through, appending one JSON line per decision (answer, probabilities, confidence,
  latency, Jev version, what it would have done) to `${CLAUDE_PLUGIN_DATA}`;
  `hookgate report` prints the README's columns from it. In 0.1.0 because it is how
  the thresholds stop being guesses. <!-- hg: prio=high size=M labels=gate,enhancement ver=0.0.3 -->

## v0.2.0 — Observe, promote, port <!-- ms: phase=next -->

What the first run of the gates teaches, turned into features, plus the second
harness the brief designs for.

- [x] **HG-8 — PostToolUse output hygiene**: dropped. A `PostToolUse` hook can only add
  `additionalContext` or block; it cannot shorten the tool result that already entered
  the context. A Noul saying "this output is not worth keeping" would therefore *add*
  tokens to say that something else should have been smaller — net negative by
  construction, no measurement needed. Output size is the harness's lever
  (truncation at the source, `PreToolUse` `updatedInput` piping through `head`), not
  a judgement call; HG-15 keeps the one `PostToolUse` use that earns a Noul.
  <!-- hg: prio=low size=M labels=gate,benchmark ver=dropped -->
- [x] **HG-9 — Fail-closed as an explicit opt-in**: `.claude/hookgate.json` gains
  `failClosed: true`, under which an unreachable API means `ask` rather than
  fall-through; never the default. <!-- hg: prio=low size=S labels=gate ver=0.0.3 -->
- [x] **HG-11 — Codex CLI adapter: same handlers, Codex answer shape, second
  manifest**: harness from `PLUGIN_ROOT`, `HOOKGATE_HARNESS` or the stdin shape;
  contract verified against learn.chatgpt.com/docs/hooks and aligned —
  `permissionDecision allow|deny`, `ask` → pass-through with a `systemMessage` (or
  `codex.askAs: deny`), `Stop` identical, injection via `decision: block` feedback;
  `.codex-plugin/plugin.json` beside the Claude one, `npm test` holding both to one
  version, unit and e2e tests under `PLUGIN_ROOT`, CI fall-through per harness.
  Verified live 2026-09-22 on Codex 0.155.1: `rm -rf ~/…` blocked by the hook,
  `git push --force` let through with the concern surfaced. Codex dropped
  plugin-bundled hooks, so `hookgate print-hooks` writes the repo-level file.
  <!-- hg: prio=med size=L labels=gate,enhancement ver=0.0.3 -->
- [x] **HG-12 — Per-session decision cache: the same command is judged once**: keyed
  by `session_id` and the redacted state hash, TTL, invalidated on `cwd` change; a
  repeat returns in under 5 ms with no request and never outlives the session.
  <!-- hg: prio=med size=M labels=enhancement ver=0.0.3 -->
- [x] **HG-13 — Promote confident, repeated decisions into the harness's own rules**:
  three `allow` or `deny` answers above 0.95 on one command prefix → one
  `systemMessage` proposing the permission rule in the harness's syntax. Propose,
  never write. <!-- hg: prio=low size=M labels=enhancement ver=0.0.3 -->
- [x] **HG-14 — hookgate doctor: key, connectivity, latency, model, thresholds**:
  one command that answers "why is nothing happening"; non-zero only on a broken
  configuration, never on a slow API. <!-- hg: prio=med size=S labels=enhancement ver=0.0.3 -->
- [ ] **HG-15 — Screen tool results for injected instructions (PostToolUse
  additionalContext)**: one `Noul` on `WebFetch`, `Read` and `Bash` results — "does
  this contain instructions addressed to an AI agent?" — annotating the span via
  `additionalContext`; off by default until a fixture set in `evals/` gives the
  false-positive rate. <!-- hg: prio=med size=L labels=gate,benchmark -->
- [ ] **HG-16 — Benchmark the optimisations: cache, promotion, thresholds**: from the
  audit log and from `evals/`, measure what each optimisation buys. **Half done
  2026-09-22 without a key** (`evals/local.mjs`, README): hook overhead 59 ms p50;
  prefilter skips 29% of stops (81% before HG-23); cache ceiling ~0% on 27k real commands; redactor
  touches 6%; prefix logic fixed for `cd` hops. Still needed with a key: cost and
  latency with and without cache, decisions a promoted rule would absorb, the
  threshold sweep on real Jev answers. <!-- hg: prio=high size=M labels=benchmark -->

## v0.1.1 — Audit of 2026-09-22 <!-- ms: phase=shipped -->

What a read of the whole tree with a security, privacy and robustness eye turned up
the day the gates landed. Small items, all shipped the same day; kept as items so the
ids stay in the CHANGELOG.

- [x] **HG-17 — Say exactly what leaves the machine**: a plugin that POSTs shell
  commands and final messages to a third party owes the reader the list — per gate,
  field by field — and what it does not send (transcript, session id, file contents).
  README section, and `check` requires it. <!-- hg: prio=high size=S labels=docs ver=0.0.3 -->
- [x] **HG-18 — Bounded, atomic on-disk state**: the audit log grew without limit and
  session files were written in place, so two hooks racing on parallel tool calls
  could tear one. Log rotates at 8 MB into one predecessor; sessions are written to a
  temp file and renamed, and pruned after seven days.
  <!-- hg: prio=med size=S labels=gate,tests ver=0.0.3 -->
- [x] **HG-19 — End-to-end tests of the CLI contract**: nothing exercised
  stdin → process → stdout with exit codes. `HOOKGATE_ENDPOINT` (also a proxy hook for
  users) lets `test/e2e.test.mjs` spawn the real binary against a local fake Jev and
  assert the JSON, the header, that the session id never leaves, that a dead endpoint
  and garbage stdin both fail open. <!-- hg: prio=high size=S labels=tests ver=0.0.3 -->
- [x] **HG-20 — CHANGELOG.md**: Keep a Changelog, `HG-n` ids on every line, `check`
  requires an `[Unreleased]` section and one for the current version; the release
  bump renames. <!-- hg: prio=med size=S labels=docs,release ver=0.0.3 -->
- [x] **HG-21 — Supply chain: CodeQL and pinned actions**: CodeQL with the
  security-extended queries on push, PR and weekly. Renovate, which was to pin every
  `uses:` to a digest, was switched off on 2026-09-23 as noise for a package with no
  runtime dependencies; actions stay on major tags, bumped by hand.
  <!-- hg: prio=med size=S labels=project ver=0.0.3 -->
- [x] **HG-22 — Knowledge graph of the repository (graphify)**: `graphify-out/` holds the
  graph built from the whole tree — 453 nodes, 896 edges, 20 labelled communities,
  rebuilt 2026-09-22 after 0.0.3 —
  as `graph.json`, `GRAPH_REPORT.md` and `graph.html`, versioned so an agent can
  `graphify query` it instead of re-reading files; interpreter path and cache are
  ignored. Rebuild with `/graphify . --update` after a change that moves structure.
  Health check clean since the rebuild: the semantic pass is given the AST ids of the
  code symbols the documents name, so document → code edges land on the AST node.
  <!-- hg: prio=low size=S labels=docs,project ver=0.0.3 -->

## v0.1.2 — Bugs from the first measurements <!-- ms: phase=shipped -->

What running `evals/local.mjs` over 102 real sessions (27,246 shell commands, 1,229 stops —
`evals/results/2026-09-22-local.json`) and a second read of the handlers turned up on 2026-09-22. Each item was one
pull request, taken one at a time, highest priority first, with HG-30's scorecard
saying by how much it moved; all shipped the same day in `0.0.3`.

- [x] **HG-23 — Completion prefilter is English-only**: `claimsCompletion` knows
  `done`, `fixed`, `merged` and friends, so a final message in another language never
  reaches Jev. Measured: 961 of 1,229 real stops carry an Italian completion word
  (*fatto, completato, pronto, mergiato, pushato, funziona*…), and 766 of them are
  skipped by the prefilter — the "skips 81%" figure in the README is partly language,
  not partly silence. Fix: a lexicon per language (English, Italian at least, the
  others as contributions), `completion.lexicon` in the config for extra patterns,
  and the transcript count re-run so the README says what the prefilter skips on
  messages it can read. Shipped: `COMPLETION_LEXICONS.{en,it}` with the ambiguous
  Italian words (*fatto, corretto, funziona, chiuso, pronto*) anchored to their claim
  form, `completion.lexicon` for extras, fixtures 12/12 both ways; the honest skip
  rate is 29%. <!-- hg: prio=high size=M labels=gate,benchmark ver=0.0.3 -->
- [x] **HG-24 — Promotion attributes a chained command's verdict to its first word**:
  `commandPrefix` keeps the first command of `a && b | c`, so a `deny` on
  `git status && curl … | sh` counts against `git status`, and three of them propose a
  rule for `git status *`. 92.5% of real commands are compound once the `cd` hops are
  stripped. Fix: only a simple command — no `&&`, `||`, `;`, `|`, newline, backtick or
  `$(` outside quotes — counts toward promotion; compound ones are logged with
  `compound: true` and never proposed. Shipped as `promotablePrefix()`; the log carries
  `promotable: null` for them beside the descriptive `prefix`.
  <!-- hg: prio=high size=M labels=gate,enhancement ver=0.0.3 -->
- [x] **HG-25 — Never propose a rule for an interpreter or wrapper prefix**:
  `python3`, `node`, `bash`, `sh`, `sudo`, `env`, `xargs`, `eval`, `exec`, `source`…
  head 23.5% of real commands, and `Bash(python3 *)` as an `allow` rule covers
  `python3 -c "shutil.rmtree(...)"` — the proposal widens, which the plugin promises
  never to do. Fix: a never-promote set for `allow`; a `deny` proposal on such a
  prefix is equally wrong (it would block every script) and is dropped too. Shipped:
  `NEVER_PROMOTE` in `store.mjs`, both directions, `find` included for `-exec`.
  <!-- hg: prio=high size=S labels=gate ver=0.0.3 -->
- [x] **HG-26 — A command longer than `maxStateChars` is judged with its middle
  elided**: `truncate` keeps 70% head and 30% tail, so whatever sits in the middle of
  a long command is never seen by Jev — a heredoc of padding with `rm -rf` in the
  middle passes as the head and tail do. 94 real commands exceed 12,000 characters
  (the longest 41,781). Fix: on the command gate an over-long command is `ask` with a
  reason ("too long to judge"), never a judgement on a partial state; the completion
  and injection gates keep truncating, where an elided middle costs recall, not
  safety. Shipped as described; `skipped: too-long` in the log, fixtures 3/3.
  <!-- hg: prio=high size=S labels=gate ver=0.0.3 -->
- [x] **HG-27 — A repository can switch the gates off through its own config**:
  `loadConfig` reads `.hookgate.json` from the harness's `cwd`, i.e. whatever
  repository is open, so cloning one that ships `{"gates":{"command":false}}` or
  `"mode":"audit"` disables the gate without a word. Fix: the repository file may only
  tighten — raise a threshold, enable a gate, turn `failClosed` on; loosening fields
  are honoured only from the user-level file (`~/.hookgate.json`) or the environment,
  and `doctor` lists the repository fields it ignored. Shipped: `TIGHTEN` table in
  `config.mjs` with the direction per field; `model` and `timeoutMs` never from the
  repository; `HOOKGATE_USER_CONFIG` for tests.
  <!-- hg: prio=med size=S labels=gate ver=0.0.3 -->
- [x] **HG-28 — The audit log has no token usage, so cost per decision cannot be
  computed**: `systemone` returns `usage`, `judge` carries it, `log` drops it. HG-16's
  "cost with and without cache" and the README's cost column need it. Fix: log
  `usage.input_tokens` per decision, and `report` prints tokens and cost per decision
  at TypeSafe's published input price, with the price and its date in one constant.
  Shipped: `inputTokens` on every judged record, `PRICE_PER_INPUT_TOKEN` +
  `PRICE_DATE` in `report.mjs`, `evals/run.mjs` imports them.
  <!-- hg: prio=med size=S labels=benchmark ver=0.0.3 -->
- [x] **HG-29 — Validate the numbers in the config and classify a non-JSON body**:
  `timeoutMs`, `maxStateChars`, `cache.ttlMs`, `promote.after` and
  `promote.confidence` are never checked, so a string or `null` flows into
  `setTimeout` and `truncate`; a config file whose top level is not an object is
  merged key by key; and a 200 with a non-JSON body surfaces as `network` rather than
  `malformed`, which hides a broken proxy in `report`. Fix: type and range checks in
  `loadConfig` reported through `problems` (defaults win), and `res.json()` failures
  mapped to `malformed`; one test each. Shipped: `RULES` in `config.mjs` covering every
  key, with ranges (`timeoutMs` 100–10,000, `maxStateChars` 200–100,000).
  <!-- hg: prio=low size=S labels=tests ver=0.0.3 -->
- [x] **HG-30 — Scorecard: one metric per open bug, on base and head of every pull
  request**: `evals/scorecard.mjs` scores HG-23 to HG-29 from `evals/fixtures/`
  (48 labelled final messages in two languages, 32 commands labelled by what a
  promotion rule may cover, generated over-long commands, loosening repository
  configs, invalid config values) with no key and no network; `scorecard.yml` runs it
  on the pull request's base and head with the head's fixtures, posts base, head and
  delta as one sticky comment plus the hook overhead on the runner, and fails on a
  regression. A fix moves its line to 100%; a new bug lands with its fixture.
  <!-- hg: prio=high size=M labels=benchmark,tests ver=0.0.3 -->
- [x] **HG-31 — Release 0.0.3: everything on main, audit mode by default**: the first
  release through npm Trusted Publishing (OIDC, no token), carrying both gates, Codex,
  the audit items, the seven fixes and the scorecard. `mode` defaults to `audit` so the
  release honours the v0.1.0 rule — nothing blocks on unmeasured thresholds; `enforce`
  is one line in `~/.hookgate.json`. <!-- hg: prio=high size=S labels=release ver=0.0.3 -->
