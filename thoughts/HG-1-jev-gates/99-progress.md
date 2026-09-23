# 99 · Progress — HG-1 Jev gates for Claude Code (and Codex) hooks

> Shared state across Implement sessions. **Update it before closing every session.**
> This is the intra-phase compaction artifact: when context passes 40%, this file is
> all that carries over to the next session.
>
> It must be self-contained: explicit paths, no reference to session context.

---

## Step status

| Step | Status | Session | Commit | Note |
|---|---|---|---|---|
| S1 | ✅ done | 1 (chain S1→S2, worktree) | `bfc9b6d` → PR #63 | `failClosed` out of TIGHTEN; 4 cases; README + CHANGELOG |
| S2 | ✅ done | 1 | `2bbd380` → PR #63 | audit never decides on error; doctor stops promising `ask` |
| S3 | ✅ done | 2 (chain S3→S4, worktree) | `3acd3f0` → PR #62 | `detectHarnessSignal`, 8-rung order, 9-row test |
| S4 | ✅ done | 2 | `dac74b0` → PR #62 | doctor prints the deciding signal and the `HOOKGATE_CONFIG` skip |
| S5 | ✅ done | 3 (chain S5→S6, worktree) | `f810a6b` | D4 decision table + Stop smoke-check runbook in CONTRIBUTING.md |
| S6 | ✅ done | 3 | `9aef9d0` | twelve docs edits; ROADMAP unchanged |
| S7 | ⬜ todo · **human** | — | — | `node evals/run.mjs commands --baseline-only` over 79 commands, ≈$10, logged-in `claude` |
| S8 | ⬜ todo · **human** | — | — | live Stop smoke check, interactive Claude Code + fake Jev — runbook in CONTRIBUTING.md |
| S9 | ⏸️ blocked · **key** | — | — | HG-4: needs `TYPESAFE_API_KEY` |
| S10 | ⏸️ blocked on S9 | — | — | apply the D4 table to the default `mode` |
| S11 | ⏸️ blocked on S9, S10, S8 | — | — | release 0.1.0: four manifests, CHANGELOG, tag |

Legend: ⬜ todo · 🔄 in progress · ✅ done · ⏸️ blocked · ❌ failed

---

## Where I left off

**Current step:** S7 (human) — the agent-executable steps S1–S6 are on `main`.

**Done so far:**
- `bin/lib/config.mjs` — `failClosed` removed from `TIGHTEN`; comment names model, timeoutMs, failClosed as repository-forbidden.
- `bin/lib/handlers.mjs` — `onError` asks only when `failClosed && gate === 'command' && mode === 'enforce'`.
- `bin/lib/harness.mjs` — `detectHarnessSignal(env, input) → { harness, signal }`; `detectHarness` delegates.
- `bin/lib/doctor.mjs` — harness line names the signal; `HOOKGATE_CONFIG` skip warned; fail-closed line qualified by mode.
- `test/handlers.test.mjs`, `test/misc.test.mjs` — 59 tests green.
- `CONTRIBUTING.md` — D4 decision table (dated, "Last run: not yet"), Stop smoke-check runbook.
- Docs reconciled per S6 (CLAUDE.md, README.md, BACKLOG.md, CONTRIBUTING.md); CHANGELOG `[Unreleased]` carries D2, D3, D5 entries.

**Next concrete action:**
- The maintainer runs S7: `cd /Users/allan/projects/github.com/hookgate && node evals/run.mjs commands --baseline-only` (plan § S7 for the pass criteria and the README row to replace), then S8 per the CONTRIBUTING.md runbook. S9–S11 wait for the key.

**Modified but uncommitted files:** none.

---

## Discoveries

Things found along the way that were not in the plan. **Do not fix them here** — they
go to a follow-up or a replanning round.

| # | Discovery | Path | Action |
|---|---|---|---|
| 1 | `DEFAULTS` comment on `failClosed` lacked "in enforce only" after S2 | `bin/lib/config.mjs:18` | fixed in the follow-up commit of this chain (one comment) |
| 2 | `doctor` ternary `env.HOOKGATE_CONFIG ? 'config' : …` unreachable after S4 | `bin/lib/doctor.mjs` | fixed in the same follow-up commit (literal) |
| 3 | `CLAUDE.md:118` is one ~200-char line after S6 row 5 | `CLAUDE.md:118` | ignore (cosmetic) |
| 4 | The plan's S4 verify line uses bash `${PIPESTATUS[0]}`; the maintainer's shell is zsh (`$pipestatus[1]`) | `04-plan.md` § S4 Verify | ignore — result was read via the zsh form |
| 5 | This file was the untouched template until session 3 | `99-progress.md` | overwritten now |

---

## Deviations from the plan

Points where the plan was wrong or incomplete. Every line here signals an upstream
artifact that needs correcting.

### D1 · S1 Verify expected the old line numbers

- **The plan said:** `grep -n 'failClosed' bin/lib/config.mjs` hits 18, 135, 148.
- **Reality is:** 18, 42, 136, 149 — line 42 is the comment the step itself adds, and it shifts the rest by one (`bin/lib/config.mjs:40-43`).
- **What I did:** executed as specified; the load-bearing check (no hit inside TIGHTEN, lines 45–63) held.
- **Artifact to fix:** `04-plan.md` § S1 Verify — corrected in this commit.
- **Re-enter:** none.
- **Landed steps:** S1 keep.
- **Status:** resolved.

### D2 · S6 row 5 contradicted S6 Verify

- **The plan said:** replace `CLAUDE.md:118` with a text whose parenthetical reads "`block: true` appears nowhere in the reference", then verify `grep -rn 'block: true' CLAUDE.md README.md` prints nothing.
- **Reality is:** the prescribed text contains the grepped string; the verify can never pass as written.
- **What I did:** applied the text as written (the parenthetical is the point: the reader learns the wrong form is unsupported); the grep hits `CLAUDE.md:118` only.
- **Artifact to fix:** `04-plan.md` § S6 Verify — the grep now excludes that one mention; corrected in this commit.
- **Re-enter:** none.
- **Landed steps:** S6 keep.
- **Status:** resolved.

### D3 · S5 runbook carried line numbers that S1–S4 had shifted

- **The plan said:** cite `bin/lib/handlers.mjs:103` and `:103-105` in the CONTRIBUTING runbook.
- **Reality is:** `:105` and `:105-107` after S1–S4 landed.
- **What I did:** wrote the current numbers — a stale line number in a runbook is a defect, not a faithful copy.
- **Artifact to fix:** none — the plan's numbers were right when written.
- **Re-enter:** none.
- **Status:** resolved.

---

## Verifications run

| Command | When | Result |
|---|---|---|
| `npm test` | S1 | ✅ 56/56 |
| `git stash push -- bin/lib/config.mjs && node --test test/handlers.test.mjs` | S1 | ✅ the new D2 test alone fails — exit 1, as required |
| `npm test` | S2 | ✅ 57/57 |
| CLI probe, audit + `HOOKGATE_FAIL_CLOSED=1`, dead endpoint | S2 | ✅ no stdout, exit 0, `outcome: error` logged |
| CLI probe, enforce, same | S2 | ✅ one `permissionDecision: ask` line |
| `hookgate doctor` in audit, grep `which asks (failClosed)` | S2 | ✅ 0 |
| `npm test`, `node --test test/misc.test.mjs` | S3 | ✅ 56/56, 13/13 |
| `git diff -U0 bin/lib/harness.mjs \| grep -c stopOutput` | S3 | ✅ 0 |
| `npm test`; doctor probes `decided by HOOKGATE_HARNESS` / `repository config skipped` / control | S4 | ✅ 14/14; 1 / 1 / 0 |
| `npm test`; CONTRIBUTING greps (`allowMode: passthrough`, `stop_hook_active`, `≥ 90`, `Last run: not yet`); link check | S5 | ✅ 59/59; 1 / 1 / 1 / 1; no broken link |
| `npm test && backlog lint && backlog check`; retired-phrase greps; `27,246` ×4; `four manifests` 1 / 2 | S6 | ✅ all green; `block: true` 1 hit at `CLAUDE.md:118` (see Deviation D2) |

---

## Context budget

| Session | Step | Peak context | Note |
|---|---|---|---|
| 1 | S1→S2 | ~12% | fresh subagent, plan sections only |
| 2 | S3→S4 | ~8% | parallel worktree |
| 3 | S5→S6 | ~25% | after S1–S4 had landed; line numbers located by text |
