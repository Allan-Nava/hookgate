# 03 · Structure — HG-1 Jev gates for Claude Code (and Codex) hooks


Decomposition of `02-design.md` (D1–D10) into steps that are implementable in one
session each and verifiable with a command. The Plan phase writes the per-step detail;
this file only fixes *what* each step is, *how it is proven done*, and *in what order*.
Every path is repo-root-relative; every `path:line` is the design's citation at HEAD
`3b93a7a` (`hookgate` 0.0.3).

Repository commands used as verifiers: `npm test` (= `node bin/hookgate.mjs check` +
`node --test`), `node evals/scorecard.mjs`, `node scripts/backlog.mjs lint|check`,
`node evals/run.mjs …`, `node bin/hookgate.mjs doctor|report`.

Legend — **Key:** needs the TypeSafe API key. **Human:** needs a person at the
keyboard (spends money or drives an interactive Claude Code session). Unmarked steps
are agent-runnable, keyless, free.

---

## Reference

Design: [`02-design.md`](./02-design.md)

---

## Steps

### S1 · D2 — `failClosed` leaves the TIGHTEN table

- **Goal:** a repository config file can no longer set `failClosed`; it lands in `ignored` and `doctor` lists it. Implements **D2, D10** (test side).
- **Touches:** `bin/lib/config.mjs:47` (remove `failClosed` from `TIGHTEN`); `test/handlers.test.mjs` (new case: repo file `failClosed: true` → `ignored` names it, and a Jev timeout in enforce still returns null); `README.md:70-77` (config trust text: `failClosed` is user-file / `HOOKGATE_CONFIG` / `HOOKGATE_FAIL_CLOSED=1` only); `CHANGELOG.md` `## [Unreleased]` line saying "move it to `~/.hookgate.json`".
- **Depends on:** — (none)
- **Verify:** `npm test` green; `grep -n failClosed bin/lib/config.mjs` shows no hit on the `TIGHTEN` line; the new test fails on `git stash` of the `config.mjs` change and passes with it.
- **Repo state after:** working; behaviour change documented under `## [Unreleased]`.

### S2 · D3 — audit mode never decides, including on error

- **Goal:** `onError` returns `ask` only when `cfg.failClosed && gate === 'command' && cfg.mode === 'enforce'`; in audit it logs `outcome: 'error'` and returns null. Implements **D3, D10**.
- **Touches:** `bin/lib/handlers.mjs:56`; `test/handlers.test.mjs` (new case with `HOOKGATE_MODE=audit` set explicitly — `test/helpers.mjs:5-30` keeps `enforce`: audit + `failClosed` + timeout → empty stdout, log record has `outcome: 'error'`); `CHANGELOG.md` `## [Unreleased]`.
- **Depends on:** S1 (same test file — append after S1's cases to avoid a merge conflict; no code dependency).
- **Verify:** `npm test` green; `HOOKGATE_MODE=audit HOOKGATE_FAIL_CLOSED=1 HOOKGATE_ENDPOINT=http://127.0.0.1:9 echo '<PreToolUse Bash event>' | node bin/hookgate.mjs <command-handler>` prints nothing to stdout and exits 0 (exact event JSON and handler name: Plan copies them from `test/helpers.mjs`).
- **Repo state after:** working; the D2/D3 pair is now covered by an audit-mode test set.

### S3 · D5 — reorder `detectHarness` and expose the deciding signal

- **Goal:** detection order becomes `HOOKGATE_HARNESS` → `CLAUDE_PLUGIN_ROOT` → `PLUGIN_ROOT` → stdin `turn_id && !prompt_id` → `CLAUDECODE | CLAUDE_PROJECT_DIR` → `CODEX_HOME` → `claude`, and the function reports *which* signal decided (needed by S4). Implements **D5**.
- **Touches:** `bin/lib/harness.mjs:9-15`; `test/misc.test.mjs` (one case per rung, plus the leak case: `CLAUDECODE=1` in env + Codex-shaped stdin `{turn_id, no prompt_id}` → `codex`; and the mirror: Claude-shaped stdin with `session_id`+`prompt_id` and `CODEX_HOME` set → `claude`); `CHANGELOG.md` `## [Unreleased]`.
- **Depends on:** — (none)
- **Verify:** `npm test` green; `node --test test/misc.test.mjs` passes the new cases; `stopOutput` (`harness.mjs:44`) is byte-for-byte unchanged (`git diff bin/lib/harness.mjs` shows no hunk there — D9).
- **Repo state after:** working; `doctor` still prints the old output (S4 consumes the new signal).

### S4 · D5 / deferral 10 — `doctor` prints the detection signal and the `HOOKGATE_CONFIG` skip

- **Goal:** `doctor` shows which signal chose the harness and warns "repository config skipped: HOOKGATE_CONFIG is set" when that variable is present. Implements **D5** (doctor half) and the design's **"Not doing", contradiction 10**.
- **Touches:** `bin/lib/doctor.mjs:19,25-29`; `test/misc.test.mjs` (or wherever `doctor` is already tested — the design does not cite a doctor test file: **finding for Plan**); `CHANGELOG.md` `## [Unreleased]`.
- **Depends on:** S3 (needs the exposed signal).
- **Verify:** `npm test` green; `HOOKGATE_HARNESS=codex node bin/hookgate.mjs doctor | grep -i 'HOOKGATE_HARNESS'` hits; `HOOKGATE_CONFIG=/dev/null node bin/hookgate.mjs doctor | grep -c 'repository config skipped'` prints 1; without the variable it prints 0; exit code unchanged from before the step (`problems` still decide it, `config.mjs:144-164`).
- **Repo state after:** working; the two new `doctor` lines are in the CHANGELOG.

### S5 · D4 + D9 — the decision table and the Stop smoke-check runbook go into CONTRIBUTING.md

- **Goal:** write the two-row HG-4 → default-mode table (D4) and the live Stop smoke-check procedure (D9: plugin install of the checkout, `HOOKGATE_MODE=enforce HOOKGATE_ENDPOINT=http://127.0.0.1:<port>`, fake Jev from `test/e2e.test.mjs:34` answering `unverified ≥ 0.7`, observables (a) one continue then a stop on `stop_hook_active`, (b) `promptKey` is `prompt_id`-based, not `msg:`) into the release runbook **before** any number exists. Text only. Implements **D4** (table), **D9** (runbook).
- **Touches:** `CONTRIBUTING.md` (release runbook section).
- **Depends on:** — (none). Must land before S9 starts.
- **Verify:** `npm test` green; `grep -c 'allowMode: passthrough' CONTRIBUTING.md` ≥ 1; `grep -c 'stop_hook_active' CONTRIBUTING.md` ≥ 1; `grep -n '≥ 90' CONTRIBUTING.md` hits; `grep -rn '](' CONTRIBUTING.md` links resolve.
- **Repo state after:** working; the rule that picks the default is on record and dated.

### S6 · D8 — one docs-reconciliation pass

- **Goal:** fix every item of research contradiction 9 as D8 lists them: `CLAUDE.md:187` drops the test count; `CLAUDE.md:200` and `CONTRIBUTING.md:10` say four manifests; `CLAUDE.md:7` says Codex shipped in 0.0.3; `CLAUDE.md:118` shows `{"decision": "block", "reason": "…"}`; `BACKLOG.md:139` (HG-16) says 29 %; corpus size 27,246 stated once with its date and `README.md:180,186` / `BACKLOG.md:184` point at `evals/results/2026-09-22-local.json`; `CONTRIBUTING.md:69` matches `BACKLOG.md:26` and the lint in `scripts/backlog.mjs:8-15`; one sentence in `CONTRIBUTING.md` that labels are on the command string (cwd is the runner's constant, `run.mjs:39`); README "What leaves the machine" states the two git-status caps (60 lines, then 3,600 chars). Implements **D8**, plus the "Not doing" notes for contradictions 6 and 7.
- **Touches:** `CLAUDE.md`, `CONTRIBUTING.md`, `BACKLOG.md`, `README.md` (the cited lines only — not `:150-158`, which is S7's).
- **Depends on:** S5 (shares `CONTRIBUTING.md`; sequence in one worktree). No code dependency.
- **Verify:** `npm test` green (`check` greps README's two load-bearing phrases, `bin/hookgate.mjs:107-108`); `node scripts/backlog.mjs lint && node scripts/backlog.mjs check` exit 0; `grep -rn 'block: true' CLAUDE.md README.md` returns nothing; `grep -rn '27,246\|27246' README.md BACKLOG.md CLAUDE.md CONTRIBUTING.md` — every hit is a pointer to, or the single statement in, the same place; `grep -c 'four manifests' CLAUDE.md CONTRIBUTING.md` ≥ 1 each.
- **Repo state after:** working; docs agree with each other and the tree at HEAD.

### S7 · D7 — rerun the `claude -p` baseline over all 79 commands · **Human**

- **Goal:** replace the n = 10 all-`safe` baseline with the full set and put the label mix in the README row. Implements **D7**. Costs ≈ $10 and ≈ 5 min of `claude` CLI time; no TypeSafe key (`evals/run.mjs:129` skips the check under `--baseline-only`).
- **Who runs it:** the maintainer, with a logged-in `claude` CLI.
- **Touches:** `evals/results/<date>-commands-baseline-only.json` (new); `README.md:150-158` (baseline row + new "labels" column `35 safe · 26 ask · 18 dangerous`, with a date and the CLI version).
- **Depends on:** — (none). Run it first: it exposes runner bugs before the paid HG-4 run (D7).
- **Verify:** `node -e "const r=require('./evals/results/<date>-commands-baseline-only.json'); if((r.results??r.cases??r).length!==79) process.exit(1)"` exits 0 (Plan fixes the field name from the 2026-09-22 file); `node evals/scorecard.mjs` prints the new file's agreement; `npm test` green; `grep -n '35 safe' README.md` hits.
- **Repo state after:** working; the README benchmark row states a number over the real label mix.

### S8 · D9 — live Stop smoke check against Claude Code with a fake Jev · **Human**

- **Goal:** prove, once, that hooks.json, argv dispatch and the session file line up in a real Claude Code session: the Stop gate blocks once on an `unverified ≥ 0.7` fake-Jev answer and lets the second attempt through (`stop_hook_active`, `handlers.mjs:103`), and the logged `promptKey` (`handlers.mjs:105`) is `prompt_id`-based on a current CLI. Implements **D9**. No code change expected.
- **Who runs it:** the maintainer, in an interactive Claude Code session with the checkout installed as a plugin, following the S5 runbook.
- **Touches:** `CONTRIBUTING.md` only if the runbook proved wrong (a corrected step), otherwise nothing; the result is a dated line in the runbook ("last run <date>, CLI <version>, pass").
- **Depends on:** S2, S3, S4 (the binary under test carries the 0.1.0 code), S5 (the runbook).
- **Verify:** `node bin/hookgate.mjs report` shows the Stop decision with `outcome` block and a `promptKey` not starting with `msg:`; the runbook line is present (`grep -n 'last run' CONTRIBUTING.md`); `npm test` still green. If (a) or (b) fails, the step's output is a research finding filed against `handlers.mjs:103-105` or the two `hooks.json` — see `recovery.md` in the plugin, not a fix in this step.
- **Repo state after:** working; the harness side is exercised end to end, which HG-4 cannot do.

### S9 · HG-4 — the Jev column · **Key** · **Human**

- **Goal:** run `node evals/run.mjs commands --baseline` once on the 79 commands at default thresholds (`config.mjs:20-25`) and put the Jev row into the README next to S7's baseline, same "labels" column, dated, with the Jev version. Produces the number D4 reads.
- **Who runs it:** the maintainer, with `TYPESAFE_API_KEY` (the runner exits 2 without it, `run.mjs:129-136`).
- **Touches:** `evals/results/<date>-commands.json` (new); `README.md:150-158` (Jev row).
- **Depends on:** S7 (baseline first, same runner), S1–S4 (the gate code that ships is what gets measured), S5 (the table must pre-date the number).
- **Verify:** `node evals/scorecard.mjs` prints agreement and the count of `safe`-labelled commands decided `deny`; `npm test` green; `grep -n 'Jev' README.md` shows the row with a date.
- **Repo state after:** working; `BACKLOG.md:45-51`'s tag precondition (table in the README) is met.

### S10 · D4 — apply the decision table to the default `mode` · *blocked on S9*

- **Goal:** exactly one of the two rows: (i) agreement ≥ 90 % and zero `safe → deny` → `config.mjs:15` default becomes `mode: enforce`, `allowMode: passthrough`, with a test asserting the default and the README default-mode text updated; (ii) anything else → code untouched, README row names the number and the release that retries. `allowMode: "allow"` is never a default. Implements **D4**.
- **Touches:** row (i): `bin/lib/config.mjs:15`, `test/misc.test.mjs` or `test/handlers.test.mjs` (default-mode assertion), `README.md:47-51,197`, `CHANGELOG.md`. Row (ii): `README.md:197`, `CHANGELOG.md`.
- **Depends on:** S9 (the number), S5 (the table it applies).
- **Verify:** `npm test` green — under row (i) the 53 enforce tests are unaffected because `test/helpers.mjs` sets `HOOKGATE_MODE=enforce` explicitly and the S1/S2 audit cases set `audit` explicitly (D10), so no test depends on the default; `node -e "import('./bin/lib/config.mjs').then(m=>console.log(JSON.stringify(m.DEFAULTS??m.defaults)))"` prints the chosen mode (Plan fixes the export name); `grep -n 'under ~90' README.md` is rewritten or gone.
- **Repo state after:** working; the default is the one the table dictates and the README says which row fired.

### S11 · D1 — release 0.1.0 · **Human** (tag) · *blocked on S9*

- **Goal:** turn `## [Unreleased]` into `## [0.1.0] — <date>` (D2, D3, D5 lines, backward-compat note for repo-level `failClosed`), set `0.1.0` in `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, flip the backlog `ver=` markers the lint expects, tag. Nothing else moves (D1).
- **Who runs it:** the maintainer (the tag push and the release workflow).
- **Touches:** the four manifests, `CHANGELOG.md`, `BACKLOG.md` (ver markers).
- **Depends on:** S1–S10 all merged; S8 passed.
- **Verify:** `npm test` green (version match across manifests is a `check` invariant); `node scripts/backlog.mjs lint && node scripts/backlog.mjs check` exit 0; `npm pack --dry-run` lists the same files as 0.0.3; `git diff --stat main` shows only the six files above.
- **Repo state after:** tagged 0.1.0; `main` carries no untagged version bump (release-drift stays quiet).

---

## Dependency graph

```
S1 ── S2 ──────────────┐
S3 ── S4 ──────────────┼── S8 (human) ──┐
S5 ── S6               │                 │
S7 (human) ────────────┴── S9 (key, human) ── S10 ── S11 (human, tag)
```

**Parallelisable** (separate worktrees, no shared files): the four chains
`S1→S2`, `S3→S4`, `S5→S6`, `S7` run concurrently. Within a chain the two steps share
a file (`test/handlers.test.mjs`; `harness.mjs`→`doctor.mjs`; `CONTRIBUTING.md`) and
run in sequence. `S8` waits for the first three chains; `S9` waits for all four and
for the key. `S10` and `S11` are strictly serial after `S9`.

Key-gated: **S9** needs the key; **S10, S11** need S9's output. Human-run: **S7, S8, S9,
S11**. Keyless and agent-runnable today: S1–S6, S10 (once the number exists).

---

## Recommended execution order

1. S1 ‖ S3 ‖ S5 ‖ S7 (S7 first if the maintainer is available — it debugs the runner before the paid run)
2. S2 ‖ S4 ‖ S6
3. S8 (human, interactive) — once S2, S4, S5 are on `main`
4. *wait for the TypeSafe key*
5. S9 (human, key)
6. S10
7. S11 (human, tag)

---

## Per-step risks

| Step | Risk | Fallback |
|---|---|---|
| S1 | How a test plants a *repository* config file is not in the design (`helpers.mjs:5-30` only injects `fetch` and env) | Plan reads `test/helpers.mjs` and `config.mjs:85` first; if there is no fixture path, add a `cwd` temp-dir fixture in `helpers.mjs` — that is a test-helper edit, not a helper-default flip (D10) |
| S3 | Exposing "which signal decided" changes `detectHarness`'s return shape; every caller must be found | Plan greps callers; keep the string-returning export and add a second export rather than change the existing one |
| S4 | No doctor test file is cited; output-format assertions are brittle | Assert on one stable substring per new line; if no doctor test exists, `check`-style grep in `npm test` is the floor |
| S5/S6 | `CONTRIBUTING.md` is touched by both, and by S8 | Same worktree, S5 then S6; S8 adds one line |
| S7 | `claude -p` cost/time drifts; runner bug surfaces mid-run | `--baseline-only` is re-runnable; a runner fix is a code step that pre-empts S9 |
| S8 | Observable (b) fails on an older CLI (`prompt_id` needs v2.1.196+) | Record the CLI version; (b) is a pass on the fallback path only if the log shows `msg:` **and** the CLI is older than v2.1.196 |
| S9 | Threshold defaults changed between 0.0.3 and the run | The run pins `config.mjs:20-25` at the tagged commit; note the thresholds in the README row |
| S10 | Row (i) flips the shipped default; a downstream user in audit gets live `ask`/`deny` | The CHANGELOG entry leads with it; `allowMode` stays `passthrough` |
| S11 | Anything besides the six files moves | `git diff --stat` is the gate; a stray change is reverted, not shipped |

---

## Status

- [x] Decomposition complete
- [x] Every step has a verification command
- [x] Every step leaves the repo working
- [x] Dependencies and parallelism mapped

> Next phase: **Plan**. It receives: this file + `02-design.md`.
