# 02 · Design — HG-1 Jev gates for Claude Code (and Codex) hooks


This is the main human checkpoint. Correcting 200 lines of markdown costs
infinitely less than correcting 2000 lines of wrong code.

Read this with `thoughts/HG-1-jev-gates/01-research.md` at hand: every `path:line`
below is cited from it (re-read at HEAD `3b93a7a`, `hookgate` 0.0.3, 2026-09-23).

---

## Problem

Both gates, the Codex adapter, audit mode, cache, promotion, doctor and report already
ship as `hookgate@0.0.3`. The first real release, 0.1.0, is gated on a benchmark
(HG-4) that cannot run without a TypeSafe API key. Research found ten places where the
shipped code, the answers in `00-questions.md` and the docs disagree — two of them
safety-relevant. 0.1.0 must close those, decide its default mode from the benchmark
by a rule written *before* the numbers exist, and separate what is buildable now from
what waits for the key.

**Ticket:** HG-1 · https://github.com/Allan-Nava/hookgate/issues/2

---

## Proposed solution

0.1.0 is a **corrective release over 0.0.3, not a redesign**: three code fixes
(`failClosed` out of the repository layer, fail-closed silenced in audit mode, harness
detection reordered), one docs reconciliation, one benchmark rerun that needs no
TypeSafe key (the `claude -p` baseline over all 79 commands), one live smoke check of
the Stop gate against a fake Jev, and a **pre-stated decision table** that maps the
HG-4 numbers to the shipped default mode. No new gate, no new config key, no new
manifest. When the key arrives, the maintainer runs `evals/run.mjs commands` once,
pastes the table into the README, applies the decision table, bumps the four
manifests and tags — nothing else is allowed to move at that point.

### Build now vs. wait for the key

| Work | Needs TypeSafe key? | Why |
|---|---|---|
| D2, D3, D5 code fixes + tests | no | unit tests inject `fetch` (`test/helpers.mjs:5-30`) |
| D7 full-set baseline | no | `--baseline-only` skips the key check (`evals/run.mjs:129`); it needs the `claude` CLI |
| D8 docs reconciliation | no | text only |
| D9 live Stop smoke check | no | `HOOKGATE_ENDPOINT` to a loopback fake Jev (`test/e2e.test.mjs:34`) |
| HG-4 Jev column, D4 mode decision, `## [0.1.0]` numbers, tag | **yes** | `evals/run.mjs` exits 2 without it (`:129-136`); `BACKLOG.md:45-51` forbids the tag before the table |

### Components to touch

| Component | Path | Kind of change |
|---|---|---|
| TIGHTEN table | `bin/lib/config.mjs:47` | modify — remove `failClosed` (D2) |
| `onError` | `bin/lib/handlers.mjs:56` | modify — require `cfg.mode === 'enforce'` (D3) |
| `detectHarness` | `bin/lib/harness.mjs:10-14` | modify — reorder signals (D5) |
| `doctor` | `bin/lib/doctor.mjs:19,25-29` | modify — print the detection signal; warn when `HOOKGATE_CONFIG` skips the repo file (D5, deferral 10) |
| `stopOutput` | `bin/lib/harness.mjs:44` | **unchanged** — the shape is the documented one (`01-research.md` "Addendum, item 1"; D9) |
| Handler tests | `test/handlers.test.mjs` | new cases: repo `failClosed` ignored; audit + failClosed + timeout → empty stdout (D2, D3, D10) |
| Detection tests | `test/misc.test.mjs` | new cases per D5 order, incl. `CLAUDECODE` + Codex stdin shape |
| Baseline result | `evals/results/<date>-commands-baseline-only.json` | new — n = 79 (D7) |
| README | `README.md:70-77,150-158,197` | modify — config trust text, benchmark row, the under-90% rule (D4, D7, D8) |
| CLAUDE.md, CONTRIBUTING.md, BACKLOG.md, CHANGELOG.md | cited lines in D8 | modify — reconcile; `## [0.1.0]` section |
| Four manifests | `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json` | modify — `0.1.0`, at tag time only |

---

## Contradictions from research → where each is settled

| # | Fact (`01-research.md`, "Facts that contradict") | Resolution |
|---|---|---|
| 1 | repo file may set `failClosed` (`config.mjs:47`) | **D2** |
| 2 | fail-closed `ask` fires in audit mode (`handlers.mjs:56`) | **D3** |
| 3 | `deny` only in enforce; default is audit (`config.mjs:15`, `handlers.mjs:88`) | **D4** — accepted as the design; Q1's wording was loose, the code is right |
| 4 | detection checks Claude's vars before Codex's (`harness.mjs:10-14`) | **D5** |
| 5 | dispatch is on argv, not `hook_event_name` (`bin/hookgate.mjs:46`) | **D6** — kept, ticket wording corrected |
| 6 | git status has two caps: 60 lines then 3,600 chars (`handlers.mjs:17`, `gates.mjs:84`) | **deferred** — see "Not doing" |
| 7 | dataset carries no cwd; runner injects it (`run.mjs:39`) | **deferred** — see "Not doing" |
| 8 | baseline is n = 10, all `safe` (`evals/results/2026-09-22-…`) | **D7** |
| 9 | docs disagree with each other and the tree | **D8** |
| 10 | `HOOKGATE_CONFIG` is an unbounded, untightened switch (`config.mjs:123-125`) | **deferred** with a `doctor` warning — see "Not doing" |

---

## Decisions

### D1 · 0.1.0 is a corrective, benchmark-gated release over 0.0.3 — no new surface

- **Choice:** the release adds no gate, no config key, no event, no manifest. Its content is exactly D2–D9 plus HG-4.
- **Why:** everything the ticket's "Done when" names already exists (`01-research.md`, Map of the territory); the open items are contradictions and one unmeasured number. New surface means new things to measure, and the only measurement instrument is blocked on a key (`BACKLOG.md:45-51`).
- **Rejected alternatives:**
  - Fold HG-15 (injection screen on by default) into 0.1.0 — rejected: its own gate is "zero false positives on the clean set" (`CONTRIBUTING.md:61-63`), a second measurement with a second failure mode in the same release.
  - Ship 0.0.4 with the fixes now and hold 0.1.0 for the key — rejected: it moves the version without a tag reason and every `release-drift` day (`release-drift.yml:11-16`) then needs a tag; the fixes are small and can wait on `main` unreleased under `## [Unreleased]`.
- **Reversible?** yes.

### D2 · `failClosed` leaves the TIGHTEN table: the repository file can never set it

- **Choice:** delete `failClosed` from `TIGHTEN` (`bin/lib/config.mjs:47`); a repo file that sets it lands in `ignored` like `model` and `timeoutMs` (`config.mjs:85`) and `doctor` lists it. The user file, `HOOKGATE_CONFIG` and `HOOKGATE_FAIL_CLOSED=1` (`config.mjs:133-135`) keep it.
- **Why:** Q9 says "never from the repository file"; the code contradicts it. Fail-closed is not a tightening of a *decision* — it converts every Jev outage into a prompt on every Bash command, which is a denial-of-service lever a cloned hostile repo should not hold. `test/handlers.test.mjs:34` never covered the case.
- **Rejected alternatives:**
  - Keep it tightenable, treat as documented behaviour — rejected: README `:70-77` says "tighten", which readers take to mean "safer", and an ask-storm is not safer, it trains the user to hit Enter.
  - Allow repo `failClosed` only when the user file already has it — rejected: then it does nothing.
- **Reversible?** yes — but a user whose repo file relied on it silently loses fail-closed; the CHANGELOG entry must say so (Impact, Backward compat).

### D3 · Audit mode never decides, including on error

- **Choice:** `onError` (`bin/lib/handlers.mjs:56`) returns `ask` only when `cfg.failClosed && gate === 'command' && cfg.mode === 'enforce'`; in audit it logs `outcome: 'error'` and returns null.
- **Why:** `CLAUDE.md:104` rule 7 and `README.md:47-51` define audit as log-only; a mode that emits nothing on a 97%-confidence `deny` but emits `ask` on a timeout is incoherent, and the shipped default *is* audit (`config.mjs:15`).
- **Rejected alternatives:**
  - Make `failClosed` imply `enforce` — rejected: two knobs silently coupled; `validate` (`config.mjs:166-172`) would have to rewrite `mode`, which it never does today.
  - Reject `failClosed: true` with `mode: audit` as a config `problem` — rejected: `problems` make `doctor` exit 1 (`config.mjs:144-164`, `doctor.mjs:28`), punishing a user who set the flag in advance of flipping to enforce.
- **Reversible?** yes.

### D4 · The default `mode` of 0.1.0 is chosen by this table, from the HG-4 run, and by nothing else

- **Choice:** run `evals/run.mjs commands --baseline` once on the 79 commands, default thresholds (`config.mjs:20-25`). Then:

  | HG-4 result at default thresholds | 0.1.0 default |
  |---|---|
  | agreement ≥ 90 % **and** no `safe`-labelled command decided `deny` | `mode: enforce`, `allowMode: passthrough` — `ask` and `deny` live, `allow` still passes through |
  | anything else | `mode: audit` stays; the README row shows the number and names the release that will retry |

  `allowMode: "allow"` is never a default in 0.1.0 whatever the number: a false `allow` runs a destructive command with no human (Q1). The table goes into `CONTRIBUTING.md` before the run.
- **Why:** the ticket's open risk says "under ~90% the command gate stays `ask`-only" (`README.md:197`), but there is no knob for ask-only and, in enforce, "ask on everything" forces a prompt on every Bash call regardless of the user's own `permissions.allow` — PreToolUse hooks run before permission evaluation and an `ask` "forces a prompt", even in auto mode (`01-research.md` "Addendum, item 4") — strictly noisier than having no plugin. Audit is the honest fallback: it keeps producing the decision log `hookgate report` needs (`report.mjs:16-55`) to tune thresholds for the retry. The "no safe → deny" clause exists because a false `deny` blocks work outright, and 79 commands cannot bound that rate finely enough to trade it against agreement.
- **Rejected alternatives:**
  - Keep the README's ask-only rule literally, via `thresholds.confidence: 1` — rejected: a hack (Jev can return 1.0), and it produces the prompt storm above.
  - A middle row, "deny-only" under 90% — rejected: needs a new knob (`ask` from Jev would have to be suppressed), and nothing measures the false-deny rate yet; a candidate for 0.2.0 once the log has data.
  - Don't tag 0.1.0 under 90% — rejected: the tag rule is "table in the README" (`BACKLOG.md:45-51`), not a pass mark; a measured, dated "not yet" is the plugin's own thesis (`CLAUDE.md:198-202`: measured numbers carry a date and a Jev version).
- **Reversible?** yes, by config; the *default* only moves at the next tag, with a new run.

### D5 · Harness detection: explicit → hook-root variable → stdin shape → ambient variable

- **Choice:** `detectHarness` (`bin/lib/harness.mjs:9-15`) becomes: `HOOKGATE_HARNESS` → `CLAUDE_PLUGIN_ROOT` → `PLUGIN_ROOT` → stdin `turn_id && !prompt_id` → `CLAUDECODE | CLAUDE_PROJECT_DIR` → `CODEX_HOME` → `claude`. `doctor` prints which signal decided.
- **Why:** the ambient `CLAUDECODE` outlives the harness that set it — a Codex run started from a Claude Code shell is shaped as Claude (`01-research.md`, contradiction 4). A hook-root variable is set for this very process; the stdin shape comes from the event itself. Both are stronger evidence than a leaked shell variable. The manifest-only Codex install (`hookgate print-hooks > .codex/hooks.json`, `bin/hookgate.mjs:139-146`) sets **none** of `PLUGIN_ROOT`, `PLUGIN_DATA`, `CODEX_HOME` and inherits `CLAUDECODE` — live probe on codex-cli 0.155.1 (`01-research.md` "Addendum, item 3") — so in that install path **the stdin rule is the only Codex signal there is**, and today's order (`harness.mjs:10-14`) reports `claude` for every Codex hook run from a Claude Code shell. The rule is safe on Claude Code: `turn_id` appears only on `MessageDisplay`, an event hookgate does not register, and every registered event carries `session_id` and `prompt_id` ("Addendum, item 2").
- **Rejected alternatives:**
  - Have `print-hooks` bake `HOOKGATE_HARNESS=codex` into the command — rejected: `check` derives the binary and handler from the command string (`bin/hookgate.mjs:67-70`) and would fail on the prefix; changing `check` for one harness is worse than ordering signals.
  - Codex signals first — rejected: the mirror-image leak (Claude Code hook in a shell exporting `CODEX_HOME`).
- **Reversible?** yes. Residual weak spot: `prompt_id` needs Claude Code v2.1.196+ and is absent before the first user input ("Addendum, item 2"); on older versions the Stop `promptKey` (`handlers.mjs:105`) falls back to `msg:<first 80 chars of last_assistant_message>`, so two prompts whose final messages share an 80-char prefix share one block — accepted, since the fallback errs towards *not* blocking (Q5) and `stop_hook_active` still bounds the loop (`handlers.mjs:103`).

### D6 · Dispatch stays on the argv handler name; the ticket's wording is corrected

- **Choice:** keep `handler(name)` dispatching on argv (`bin/hookgate.mjs:46`); `hook_event_name` stays a logged field (`handlers.mjs:39`). README and CLAUDE.md describe it that way.
- **Why:** the routing is visible in the two `hooks.json` files and `check` verifies it statically (`bin/hookgate.mjs:67-70,98-99`) — a misrouted event fails `npm test`, not a live session. Whether Codex and Claude Code spell event names identically is not in research; argv dispatch does not care.
- **Rejected alternatives:**
  - Dispatch on `hook_event_name` — rejected: one wrong name in either harness's stdin becomes a silent no-op at runtime.
- **Reversible?** yes.

### D7 · Rerun the `claude -p` baseline over all 79 commands now; the README row carries the label mix

- **Choice:** `node evals/run.mjs commands --baseline-only` on the full set (≈ 79 × $0.13 ≈ $10, ≈ 5 min at p50 3.5 s — `evals/results/2026-09-22-commands-baseline-only.json`); replace the README row (`README.md:150-158`) and add a "labels" column (`35 safe · 26 ask · 18 dangerous`) that the eventual Jev row must also fill.
- **Why:** the current 100 % is ten `safe` commands (`01-research.md`, contradiction 8) — the one label mix where `allow` is always right. Shipping that number under a heading "agreement" is the kind of claim the plugin exists to refuse. It needs no TypeSafe key.
- **Rejected alternatives:**
  - Wait and run both columns together — rejected: the baseline has no dependency on the key, and running it first exposes runner bugs before the paid run.
  - Add `cwd` to the dataset records — rejected: labels are on the command string (Q3), the runner's fixed cwd (`run.mjs:39`) is the right place for a constant.
- **Reversible?** yes.

### D8 · Docs are reconciled in one pass; drifting counts are removed, not check-enforced

- **Choice:** fix each item of contradiction 9: `CLAUDE.md:187` drops the test count entirely; `CLAUDE.md:200` and `CONTRIBUTING.md:10` say four manifests; `CLAUDE.md:7` says Codex shipped in 0.0.3; `CLAUDE.md:118` is rewritten to `{"decision": "block", "reason": "…"}` — the shape Claude Code documents; `block: true` appears nowhere in the hooks reference (`01-research.md` "Addendum, item 1"); `BACKLOG.md:139` (HG-16) takes 29 %; the corpus size is stated once as 27,246 with its date, from `evals/results/2026-09-22-local.json`, and `README.md:180,186` / `BACKLOG.md:184` point at it; `CONTRIBUTING.md:69` matches `BACKLOG.md:26` (`ver=0.0.3` for shipped items, `ver=main` for unreleased — whichever the backlog lint already enforces, `scripts/backlog.mjs:8-15`).
- **Why:** `check` already greps README for two load-bearing phrases (`bin/hookgate.mjs:107-108`); the drifting items are counts that change with every PR.
- **Rejected alternatives:**
  - Make the counts `check` invariants — rejected: every added test becomes a docs edit, and `check` then fails on the thing least worth failing on.
- **Reversible?** yes.

### D9 · The Stop gate gets a live smoke check against Claude Code with a fake Jev before the tag

- **Choice:** the output shape is settled and stays `{decision:'block', reason}` (`harness.mjs:44`; `01-research.md` "Addendum, item 1") — no code change. What remains is a smoke check, written into the `CONTRIBUTING.md` release runbook: install the checkout as a plugin, `HOOKGATE_MODE=enforce HOOKGATE_ENDPOINT=http://127.0.0.1:<port>` with the loopback fake from `test/e2e.test.mjs:34` answering `unverified ≥ 0.7`, end a turn with a completion claim, and observe (a) that Claude continues once and stops on the second attempt (`stop_hook_active`, `handlers.mjs:103`), (b) that the decision log recorded a `prompt_id`-based `promptKey` (`handlers.mjs:105`), not the `msg:` fallback, on a current CLI.
- **Why:** the shape was the open question and the addendum closed it by reading the raw reference; but the code has still never run against a live Claude Code Stop (`01-research.md`, Blind spots 1–2), and a smoke check with a fake Jev is free. It exercises exactly the path the paid HG-4 run cannot: the harness side.
- **Rejected alternatives:**
  - Skip the live check now that the contract is read — rejected: the contract says what is accepted, not that the plugin's hooks.json, argv dispatch and session file line up in a real session; one run answers all three.
  - Emit both `decision:'block'` and `block:true` — rejected: `block: true` is documented nowhere ("Addendum, item 1").
- **Reversible?** yes.

### D10 · Tests gain an audit-mode set instead of flipping the enforce default in `helpers.mjs`

- **Choice:** `test/helpers.mjs:5-30` keeps `HOOKGATE_MODE=enforce`; new cases pass `HOOKGATE_MODE=audit` explicitly: audit + `failClosed` + timeout → empty stdout; repo file `failClosed: true` → `ignored` lists it and a timeout still falls through.
- **Why:** 53 existing cases assume enforce (`01-research.md`, Existing patterns); the shipped default is audit, so the bugs in D2/D3 were invisible. Flipping the helper would rewrite 53 tests to expose two.
- **Rejected alternatives:**
  - Parametrise every handler test over both modes — rejected for 0.1.0: doubles a suite whose enforce half is the one that matters for decisions.
- **Reversible?** yes.

---

## Impact

| Area | Impact | Mitigation |
|---|---|---|
| DB schema | none — decision-log record (`handlers.mjs:39`) and session file (`store.mjs:44-75`) unchanged | — |
| Public API | config: `failClosed` in a repository file becomes ignored (D2); `doctor` gains two lines (D5, deferral 10); output shapes unchanged (D9) | CHANGELOG `## [0.1.0]` names each; `doctor` shows the ignored field |
| Performance | none — D5 is env lookups; D3 removes a branch | — |
| Security | tighter: a cloned repo can no longer trigger prompt storms via `failClosed` (D2); detection less spoofable by ambient env (D5) | — |
| Data migration | none | — |
| Backward compat | a user who relied on a repo-level `failClosed` loses it silently at runtime | `doctor` lists it under `ignored`; CHANGELOG says "move it to `~/.hookgate.json`" |

---

## What we are NOT doing

- **Contradiction 6 — the git status double cap.** Kept as is and documented at `README.md` "What leaves the machine": 60 lines (`handlers.mjs:17`) then middle-out truncation at 3,600 chars (`gates.mjs:84`). Nothing measures whether the lost middle ever mattered; the completion gate has no benchmark yet (HG-4 is commands and injection only, `run.mjs:26`). Revisit when a completion set exists.
- **Contradiction 7 — cwd in the dataset.** The label is on the command string by Q3; `CONTRIBUTING.md` says so in one sentence (D8 pass). No schema change.
- **Contradiction 10 — `HOOKGATE_CONFIG` as an untightened switch.** Documented trusted (`README.md:70-77`); it is the maintainer's own lever for CI and wrappers. 0.1.0 only adds a `doctor` line: "repository config skipped: HOOKGATE_CONFIG is set" (`doctor.mjs:25-29`). Tightening it would break the one legitimate use.
- **HG-15 / HG-16** (injection default on; benchmark the optimisations) — 0.2.0; see D1.
- **A knob for `deny`-only or `ask`-only vocabularies** — see D4; needs data the audit log will produce.
- **`allowMode: "allow"` as a default** — never in 0.1.0 (Q1).
- **Anything the Questions phase excluded** — other tools, other harnesses, telemetry, a local fallback classifier (`00-questions.md`, Out of scope).

---

## More research needed

Facts the design assumed that the first research pass did not verify. All six were settled by the targeted round recorded in `01-research.md` "Addendum — targeted round, 2026-09-23":

- [x] Which Stop output Claude Code honours — `{decision:'block', reason}` (`harness.mjs:44`) or `block: true` (`CLAUDE.md:118`). → settled: `{"decision": "block", "reason"}` is the documented shape and `block: true` occurs nowhere in the hooks reference (Addendum, item 1); `CLAUDE.md:118` is wrong, the code is right — carried into D8 (rewrite) and D9 (no longer a contract question, now a smoke check).
- [x] Whether any Claude Code event carries `turn_id` without `prompt_id`, and whether Stop carries `prompt_id` at all. → settled: `turn_id` appears only on `MessageDisplay`, which hookgate does not register; `session_id` and `prompt_id` are common fields of every event, so D5's stdin rule cannot misfire on Claude Code. Caveat carried into D5: `prompt_id` needs v2.1.196+ and is absent before the first user input, so older CLIs fall back to the `msg:` 80-char `promptKey` (`handlers.mjs:105`) (Addendum, item 2).
- [x] Whether Codex sets `PLUGIN_ROOT` or `CODEX_HOME` in hooks launched from `.codex/hooks.json`. → settled: none of `PLUGIN_ROOT`, `PLUGIN_DATA`, `CODEX_HOME` is set in the manifest-only install, and `CLAUDECODE` is inherited — live probe, codex-cli 0.155.1 (Addendum, item 3); D5's stdin rule is the only Codex signal on that path, which makes the reorder mandatory, not cosmetic.
- [x] Whether a hook `ask` overrides a matching `permissions.allow`. → settled: PreToolUse hooks run before permission evaluation and an `ask` "forces a prompt", also in auto mode (Addendum, item 4); D4's rejection of ask-only stands.
- [x] Whether Codex accepts `hookSpecificOutput.hookEventName` on `ask`-as-`deny` (`harness.mjs:30`). → settled: the documented Codex deny shape carries `hookEventName` (kept as is); and Codex rejects `permissionDecision: "ask"` outright — marks the hook failed and continues the tool call — so `codex.askAs: deny` is the only working shape for `ask` on Codex (Addendum, item 5). No change to D5/D6.
- [x] Whether any harness omits `session_id` on Stop. → settled: both harnesses document `session_id` on every event including Stop (Addendum, item 6); the `no-session` pooling in `store.mjs:44` is dead-path defence, not a live risk.

> All items settled; no further Research round is needed before Structure. What the
> addendum could **not** settle: whether `hookEventName` is *required* on the Codex
> deny shape (item 5) — irrelevant while the code always sends it.

---

## Review

| Comment | From | Status | Resolution |
|---|---|---|---|
| | | open / resolved | |

---

## Status

- [x] Design written
- [x] Anchored to research facts (every claim has a path)
- [x] Alternatives documented
- [ ] Reviewed by the team
- [ ] Comments resolved
- [ ] Approved

> Next phase: **Structure**. It receives: this file only.
