# 01 · Research — HG-1 Jev gates for Claude Code (and Codex) hooks


This is the most expensive phase and the one with the highest compression ratio
(~30-50×). It is also the one that most needs subagents.

State of the tree at research time: `hookgate` 0.0.3, HEAD `3b93a7a`, 2026-09-23. Both
gates, the Codex adapter, audit mode, cache, promotion, doctor and report are already
shipped; the open items are HG-1 (this run), HG-4 (benchmark), HG-5 (release 0.1.0),
HG-15 (injection screen on by default), HG-16 (benchmark the optimisations) —
`BACKLOG.md:53,68,75,131,136`. The line numbers below are from the files as they are at
HEAD; the knowledge graph in `graphify-out/` is three commits older and its line refs
drift by a few lines in `bin/lib/handlers.mjs`.

---

## Reference questions

From `00-questions.md` — the answers that steer this research:

- Q1 → all three decisions exist; `allowMode: "passthrough"` default (a confident `allow` emits nothing), `allowMode: "allow"` opt-in; plugin ships `mode: audit` until HG-4 runs.
- Q2 → `~/.hookgate.json` and `HOOKGATE_CONFIG` are trusted; a repo file may only tighten, field by field (`TIGHTEN`); `model`/`timeoutMs` never from the repo; ignored fields shown by `hookgate doctor`.
- Q3 → 79 commands (35 safe · 26 ask · 18 dangerous) labelled by agent + maintainer against the CONTRIBUTING rule; label is on the command string with a fixed synthetic cwd; maintainer reviews before HG-4.
- Q4 → shipping commands to the API accepted; `bin/lib/redact.mjs` redacts keys/tokens/JWTs/URL creds/`KEY=`/`--password`/40+ hex; cwd = last two segments; README "What leaves the machine" required by `check`; no per-repo off switch.
- Q5 → one Stop block per prompt, doubled: harness `stop_hook_active` plus a per-prompt marker in the session file.
- Q6 → git state = `git status --porcelain --branch` capped at 60 lines, empty outside a repo; the transcript is never read.
- Q7 → Jev called only when `claimsCompletion()` fires; lexicon per language (en, it) + `completion.lexicon` extras; measured skip rate 29% on 1,229 real stops, not 81%.
- Q8 → reference is `claude -p --model claude-opus-5` from an empty temp dir (`evals/run.mjs --baseline`), $0.129/decision, p50 3.5 s on ten commands; CONTRIBUTING calls it a proxy; maintainer-run, not CI.
- Q9 → `failClosed: true` turns timeout/HTTP/malformed/network into `ask` on the command gate only; `no-key`/`bad-key` always fall through; Stop always fail-open; flag honoured from user file and environment, **never from the repository file**.
- Q10 → Codex shipped in full in 0.0.3: detection from `PLUGIN_ROOT`, `HOOKGATE_HARNESS` or stdin shape; `codex/hooks.json`, `.codex-plugin/plugin.json`, e2e per harness; Codex has no `ask` — passthrough with `systemMessage`, or deny via `codex.askAs: deny`.

---

## Map of the territory

### Components involved

| Area | Path | Role |
|---|---|---|
| CLI entry | `bin/hookgate.mjs` (155 lines) | argv[2] subcommand switch: `check`, `pre-tool-use`, `stop`, `post-tool-use`, `doctor`, `print-hooks`, `report`, default help (`:123-153`). No exports. |
| Handlers | `bin/lib/handlers.mjs` (150) | the three gates end to end: config → key → state → cache → Jev → decide → log → shape (`preToolUse :60`, `stop :95`, `postToolUse :130`) |
| Gates | `bin/lib/gates.mjs` (129) | question constants, state builders, deciders, completion prefilter lexicons |
| Harness | `bin/lib/harness.mjs` (64) | `detectHarness`, `dataDir`, and the five output shapers per harness |
| Config | `bin/lib/config.mjs` (174) | `DEFAULTS`, layered `loadConfig`, `TIGHTEN` table, `RULES` validation |
| Jev client | `bin/lib/jev.mjs` (50) | `systemone()` — one `fetch`, `JevError` with codes |
| Redaction | `bin/lib/redact.mjs` (34) | 13 regex classes, middle-out `truncate`, `prepare = truncate(redact())` |
| Store | `bin/lib/store.mjs` (149) | decision log (jsonl, rotated), per-session file (cache, prefixes, blockedPrompts), prefix promotion |
| Report | `bin/lib/report.mjs` (70) | `summarize`/`render` of the decision log: outcomes, p50/p95, cost, ask share per threshold |
| Doctor | `bin/lib/doctor.mjs` (58) | harness, paths, config problems/ignored, key sanity, live ping |
| Hook contracts | `hooks/hooks.json`, `codex/hooks.json` | PreToolUse(`Bash`), PostToolUse(`WebFetch\|WebSearch\|Read\|Bash`), Stop — timeout 5 s each |
| Manifests | `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json` | all at `0.0.3`; `check` requires the four to match (`bin/hookgate.mjs:88-89`) |
| Evals | `evals/run.mjs`, `evals/local.mjs`, `evals/scorecard.mjs` + `evals/*.jsonl`, `evals/fixtures/*.jsonl`, `evals/results/*.json` | benchmark runner (needs key), offline overhead/transcript stats, per-bug scorecard (CI) |
| Tests | `test/*.test.mjs`, `test/helpers.mjs` | 53 `node:test` cases, no network, fetch injected or loopback |
| Backlog tooling | `scripts/backlog.mjs`, `scripts/backlog_test.mjs` | BACKLOG.md lint/roadmap/issue sync; ROADMAP.md is generated (`CLAUDE.md:59`) |
| Site | `site/build.mjs` → `site/dist/` (gitignored, `.gitignore:2`) | README → HTML, no prose of its own (`CLAUDE.md:72`) |

### Entry points

| Symbol | Path:line | What it does |
|---|---|---|
| `handler(name)` | `bin/hookgate.mjs:41` | reads stdin JSON (`:31`), dispatches on the **argv** name (`:46`) — not on `hook_event_name`; prints JSON only when the handler returns non-null (`:48`); any throw → stderr + exit 0 (`:49-53`) |
| `check()` | `bin/hookgate.mjs:80` | the `npm test` gate — see Constraints |
| `preToolUse(input, deps)` | `bin/lib/handlers.mjs:60` | gate off or tool ≠ `Bash` → null (`:65`); no key → null (`:66`); over-long → `ask`/null (`:72-75`); audit or passthrough-allow → null (`:88`) |
| `stop(input, deps)` | `bin/lib/handlers.mjs:95` | `stop_hook_active` → null (`:103`); prompt already blocked → null (`:106`); prefilter miss → logged skip (`:108-110`); `block` only in enforce (`:118`) |
| `postToolUse(input, deps)` | `bin/lib/handlers.mjs:130` | only for `INJECTION_TOOLS` (`:11`); output < 40 chars → null (`:137`); `annotate` only in enforce (`:145`) |
| `onError(e, gate, …)` | `bin/lib/handlers.mjs:52` | the single fail-open/fail-closed switch |
| `gitStatus(cwd)` | `bin/lib/handlers.mjs:13` | the only git invocation: `status --porcelain --branch`, 1,500 ms timeout, first 60 lines (`:17`), `''` on failure |
| `decideCommand` / `decideCompletion` / `decideInjection` | `bin/lib/gates.mjs:98,111,121` | vocabularies `allow\|ask\|deny`, `block\|null`, `annotate\|null` |
| `claimsCompletion(message, extra)` | `bin/lib/gates.mjs:68` | en+it lexicons (`:56`), `TICKED_TASK`, `ALL_TESTS` (`:63-64`), user regexes compiled with `i`, bad regex swallowed |
| `detectHarness(env, input)` | `bin/lib/harness.mjs:9` | order: `HOOKGATE_HARNESS` → `CLAUDE_PLUGIN_ROOT\|CLAUDE_PROJECT_DIR\|CLAUDECODE` → `PLUGIN_ROOT\|CODEX_HOME` → stdin `turn_id && !prompt_id` → `claude` |
| `permissionOutput(…)` | `bin/lib/harness.mjs:22` | Claude: `hookSpecificOutput.{hookEventName,permissionDecision,permissionDecisionReason}`; Codex `ask`: bare `{systemMessage}` or `deny` when `codexAskAs === 'deny'` (`:30`) |
| `stopOutput(harness, reason)` | `bin/lib/harness.mjs:44` | both harnesses `{decision:'block', reason}`; Claude adds `hookSpecificOutput.hookEventName` |
| `loadConfig(cwd, env)` | `bin/lib/config.mjs:116` | returns `{cfg, path, userPath, problems, ignored}` |
| `systemone({state, questions, model, apiKey, timeoutMs, fetchImpl, endpoint})` | `bin/lib/jev.mjs:16` | body `{state, model, questions}` (`:28`); returns `{answers, model, usage, latencyMs}` (`:42`) |
| `doctor({cwd, env, fetchImpl})` | `bin/lib/doctor.mjs:9` | `{lines, broken}`; only config `problems` and a non-ASCII key set `broken` (`:28,37`) |
| `report(dir)` | `bin/lib/report.mjs:70` | `render(summarize(readDecisions(dir)))` |
| `run.mjs` | `evals/run.mjs:26-30` | `commands\|injection`, `--baseline`, `--baseline-only`, `--limit N` |

---

## Existing patterns and conventions

### Fail-open by construction, one switch for fail-closed

- **Where:** `bin/hookgate.mjs:43,48,49-53`; `bin/lib/handlers.mjs:52-58`
- **How it works:** "no decision" is empty stdout, never a JSON null (`bin/hookgate.mjs:48`). Every error path — unparseable stdin, thrown handler, `JevError` — ends in exit 0. `onError` alone converts an error to `ask`, and only when `cfg.failClosed && gate === 'command'` (`handlers.mjs:56`); `no-key`/`bad-key` are excluded first (`:55`). Every store access is wrapped in `safe()` (`bin/lib/store.mjs:9`).
- **Who already uses it:** all three handlers' `catch` blocks (`handlers.mjs:90,126,148`); CI asserts empty stdout for `rm -rf /` with no key under both root vars (`.github/workflows/ci.yml:31-35`).

### Config trust layering with a tighten-only repository layer

- **Where:** `bin/lib/config.mjs:11-31` (defaults), `:45-92` (`TIGHTEN`/`tighten`), `:116-138` (`loadConfig`), `:144-173` (`RULES`/`validate`)
- **How it works:** DEFAULTS → `~/.hookgate.json` (or `HOOKGATE_USER_CONFIG`, `:114`) → if `HOOKGATE_CONFIG` is set, that file merged **untightened and the repo file is never read** (`:123-125`) → else first of `<cwd>/.hookgate.json`, `.claude/hookgate.json`, `.codex/hookgate.json` (`:128`) passed through `tighten()` → env `HOOKGATE_MODE`, `HOOKGATE_MODEL`, `HOOKGATE_FAIL_CLOSED=1` (`:133-135`, bypass TIGHTEN) → `validate`, which replaces a bad value with the default and records a problem, never throws (`:166-172`). Keys absent from `TIGHTEN` (`model`, `timeoutMs`) are rejected with a message in `ignored` (`:85`); `completion.lexicon` is concatenated (`:87`).
- **Who already uses it:** `handlers.mjs:61,96,131`; `doctor.mjs:25-29` prints `problems` as BAD and `ignored` as warn; `evals/run.mjs:41` uses `DEFAULTS` directly.

### Harness detection once, output shaping per harness

- **Where:** `bin/lib/harness.mjs:9-15` (detect), `:22-63` (five shapers + `ruleSyntax`)
- **How it works:** the handlers compute the harness once and call shapers; nothing else in `bin/lib` branches on the harness. Codex `PostToolUse` has no `additionalContext`, so `postToolOutput` emits `{decision:'block', reason}` there (`:52`; contract note `CLAUDE.md:141-143`). `ruleSyntax` renders a Codex `prefix_rule()` or a Claude `permissions.<decision>` entry (`:58-63`).
- **Who already uses it:** `handlers.mjs:87-89,118,145`; `test/misc.test.mjs:79,204`; `test/e2e.test.mjs:91` (Codex env).

### Redact, then truncate, then cap per field

- **Where:** `bin/lib/redact.mjs:5-17` (13 classes), `:26` (`truncate`, 70% head / 30% tail, marker `…[N chars elided by hookgate]…`), `:34` (`prepare`); `bin/lib/gates.mjs:38-94` (caps)
- **How it works:** caps are characters, not tokens: command `maxStateChars` 12,000 (`config.mjs:31`), description 400, cwd 200 (`gates.mjs:40-43`), final message `floor(0.6 × maxStateChars)` = 7,200, git status `floor(0.3 ×)` = 3,600 (`gates.mjs:82-84`), tool output 12,000 (`:93`). cwd is `split('/').slice(-2)` (`gates.mjs:42`). No token counting exists anywhere in `bin/`.
- **Who already uses it:** all three state builders; `evals/local.mjs` counts commands the redactor would change (5.58% of 27,246 — `evals/results/2026-09-22-local.json`).

### Bounded, atomic on-disk state under one data dir

- **Where:** `bin/lib/store.mjs:21-31` (log, `LOG_MAX` 8 MiB, one rotation to `decisions.1.jsonl`), `:44-75` (sessions: `<dataDir>/sessions/<id>.json`, tmp+rename, 7-day prune on ~5% of writes), `:79-97` (cache: key = sha256-16 of `gate\ncwd\nstate`, TTL `cache.ttlMs` 1 h, max 500 entries), `:99-149` (prefix + promotion)
- **How it works:** `dataDir` = `HOOKGATE_DATA ?? CLAUDE_PLUGIN_DATA ?? PLUGIN_DATA ?? ~/.hookgate` (`harness.mjs:17`). A decision record carries `at, gate, event, session, tool, mode` plus per-gate extras (`handlers.mjs:39`). Promotion proposes once per prefix per session after `promote.after` = 3 verdicts at ≥ `promote.confidence` = 0.95 (`config.mjs:29`, `store.mjs:138-147`); `NEVER_PROMOTE` lists 34 interpreters/wrappers (`store.mjs:121`); any `&& || ; | \n \` $(` outside quotes → not promotable (`:131-132`).
- **Who already uses it:** `handlers.mjs:27-29,84-87,105-120`; `report.mjs:16-55` reads the log; `test/misc.test.mjs:179,191`.

### Tests inject `fetch`; e2e spawns the binary against a loopback fake Jev

- **Where:** `test/helpers.mjs:5-30` (`tmp`, `fakeFetch` with abort-aware delay, `env`, `preInput`); `test/e2e.test.mjs:34` (spawn + `HOOKGATE_ENDPOINT` to `127.0.0.1:0`)
- **How it works:** `env()` sets `TYPESAFE_API_KEY=sk-test-…`, `HOOKGATE_DATA`, `CLAUDE_PLUGIN_ROOT=/plugin`, `HOOKGATE_USER_CONFIG`, `HOOKGATE_MODE=enforce` — so unit tests run in **enforce**, not the shipped audit default. Handlers accept `deps = {env, fetchImpl, gitStatus}` (`handlers.mjs:60,95-96,130`).
- **Who already uses it:** all six suites; the runner is `node --test` with default discovery (`package.json:24`).

### Docs phrases and manifest shape are `check` invariants; every idea is an HG-n

- **Where:** `bin/hookgate.mjs:80-116`; `CLAUDE.md:106-110`; `scripts/backlog.mjs:8-15`
- **How it works:** `check` greps README for `/what leaves the machine/i` and `/fail-open|fails open/i` (`:107-108`), requires seven docs (`:101`), `## [Unreleased]` plus a `## [<version>]` CHANGELOG section (`:104-105`). BACKLOG.md items carry `<!-- hg:` ids and `ver=`; `backlog.mjs check` fails CI when ROADMAP.md is stale (`ci.yml:56-58`). Each fixed bug gets a fixture and a scorecard metric (`CONTRIBUTING.md:34-45`; `evals/scorecard.mjs:52-169`, 11 metrics over HG-23…HG-29).

---

## Constraints

| Constraint | Source | Impact |
|---|---|---|
| Hook timeout must be numeric and ≤ 10 s; PreToolUse must carry a `Bash` matcher; Stop must exist; command must be `${rootVar}/bin/hookgate.mjs` | `bin/hookgate.mjs:65-76` | both hooks files are locked to this shape; new events need `HOOK_EVENTS` (`:56`) and `HANDLERS` (`:57`) |
| Both hooks files must register the same sorted handler set | `bin/hookgate.mjs:98-99` | a handler added for one harness must be added for both |
| Four manifests, one version; name `hookgate`; marketplace `source: "./"`; repo URL anchored to `Allan-Nava/hookgate`; zero `dependencies`; eight `files` entries | `bin/hookgate.mjs:88-94` | `npm test` fails on drift; evals/tests/scripts/docs other than README, CHANGELOG, LICENSE never ship (`package.json:9-18`) |
| Nine lib modules must exist by name | `bin/hookgate.mjs:109` | renaming or splitting `bin/lib/*.mjs` touches `check` |
| `engines.node >= 18`; CI matrix 18/20/22/24 with no `npm install`; release runs `npm install --ignore-scripts` then `npm test` | `package.json:19-21`; `.github/workflows/ci.yml:21-28`; `release.yml:84-85` | only `node:` builtins and Node-18 syntax in `bin/`; `AbortController`+`setTimeout` is used, not `AbortSignal.timeout` (`jev.mjs:21-22`) |
| Release tag `hookgate--v<version>` must equal `package.json` version; OIDC Trusted Publishing, no npm token; `--provenance` deliberately not passed; milestone closed only at 0 open issues | `release.yml:17,59-70,88,162-179`; `CONTRIBUTING.md:104-127` | never rename `release.yml`, never give setup-node a `registry-url` |
| A version on `main` with no tag for > 2 h fails `release-drift` (daily cron) | `.github/workflows/release-drift.yml:11-16,42-47` | bump and tag in the same PR cycle |
| Jev request body is exactly `{state, model, questions}`; headers `Authorization: Bearer`, `Content-Type`, `User-Agent: hookgate`; response must have `answers` object | `bin/lib/jev.mjs:27-28,39-41` | consumed answer fields are `choice`, `confidence`, `noul`; `usage.input_tokens` for cost (`handlers.mjs:37`) |
| Jev limits (dated 2026-09-22): 64k/request, 32k state, 250k tok/s, 1,200 req/min; price $42 per 1e9 input tokens, output free; model `jev-1.13.0`, aliases `jev-latest`/`jev-preview` | `CLAUDE.md:124-132`; `report.mjs:7-8` | the 32k state limit is enforced only by character caps (12,000 chars) — no token count |
| Default thresholds `confidence 0.7, destructive 0.5, unverified 0.7, injection 0.7`; below confidence → `ask`; `allow` + destructive ≥ 0.5 → `ask` | `config.mjs:20-25`; `gates.mjs:104-105`; `CLAUDE.md:92-93` | rule 2 "below threshold is ask, never allow" is code, tests (`test/gates.test.mjs:11`) and CLAUDE.md |
| `mode: audit` default; nothing ships `enforce` by default, no threshold moves, no `v0.1.0` tag before HG-4's table is in the README; blocked on an API key since 2026-09-22 | `config.mjs:15`; `BACKLOG.md:45-51`; `CHANGELOG.md:19-21` | the release gate is a measurement the maintainer must run; `evals/run.mjs` exits 2 without a key (`:129-136`) |
| Under ~90% agreement the command gate ships `ask`-only; injection screen off until zero false positives on the clean set | `README.md:197`; `CONTRIBUTING.md:61-63` | pre-stated, dated rule — the benchmark decides the shipped vocabulary |
| Claude Code contract (read 2026-09-22): stdin `session_id, cwd, hook_event_name, tool_name, tool_input, tool_use_id`; Stop `last_assistant_message, stop_reason`; default command timeout 600 s | `CLAUDE.md:114-122` | no `prompt_id` is documented for Claude Code — see Blind spots |
| Codex contract (verified 2026-09-22 on 0.155.1): no `ask` on PreToolUse; no `additionalContext` on PostToolUse; `plugin_hooks` removed, so `.codex-plugin/` is manifest-only and install is `hookgate print-hooks > .codex/hooks.json`; repo hooks need persisted trust | `CLAUDE.md:134-156`; `README.md:133-134`; `bin/hookgate.mjs:139-146` | `.codex-plugin/plugin.json:9` points at `codex/hooks.json` but Codex will not load it from a plugin |
| Config validation ranges: `timeoutMs` 100–10,000; `maxStateChars` 200–100,000; thresholds in [0,1]; `promote.after` integer ≥ 1 | `config.mjs:144-164` | out-of-range → default + `problems` entry → `doctor` exits 1 |
| Prose: British-leaning, em-dashes, no decorative emoji; measured numbers carry a date and the Jev version; no tool-attribution footer | `CLAUDE.md:198-202` | applies to README, CHANGELOG, BACKLOG edits |
| Names use neither "Jev" nor "TypeSafe" as marks | `CLAUDE.md:101-102` | package name, event names, hook status messages |
| Site has no prose of its own — README and `hooks/hooks.json` are its only sources | `CLAUDE.md:72`; `site/build.mjs:2-8` | README edits are site edits; `pages.yml:3-13` deploys on README/hooks changes |

---

## Reuse candidates

What already exists and should not be rewritten:

| What | Path | Note |
|---|---|---|
| Benchmark runner incl. `claude -p` baseline | `evals/run.mjs:41-60,92-127,146-147` | writes `evals/results/<date>-<set>-<jev model>.json`; computes agreement, p50/p95, cost, ask share at 0.5–0.9, dangerous-allowed count; not wired to CI |
| Labelled datasets | `evals/commands.jsonl` (79: 35/26/18), `evals/injection.jsonl` (20: 10/10), `evals/fixtures/completion.jsonl` (48, en/it balanced), `evals/fixtures/prefixes.jsonl` (32) | schema `{command,label}`; cwd is injected by the runner as `/home/dev/projects/app` (`run.mjs:39`) |
| Baseline result already on disk | `evals/results/2026-09-22-commands-baseline-only.json` | n = 10, all `safe`; agreement 10/10, p50 3,532 ms, p95 4,675 ms, $0.1293/decision — the README table row (`README.md:150-158`) |
| Offline overhead + transcript statistics | `evals/local.mjs:36-156`; `evals/results/2026-09-22-local.json` | 30-spawn p50/p95 (no key 59 ms, cache hit 62, fake Jev 83); 102 sessions, 27,246 commands, 0.36% repeats, 5.58% redacted, 6.40% promotable, 1,229 stops / 878 claims |
| Per-bug scorecard with CI base/head compare | `evals/scorecard.mjs`; `.github/workflows/scorecard.yml:33-73` | `--root` scores another checkout; sticky PR comment; fork PRs skipped |
| Report summariser (percentiles, cost, ask share) | `bin/lib/report.mjs:16-55` | same maths the benchmark table needs; price constant and date at `:7-8` |
| Fake Jev + env helpers | `test/helpers.mjs:5-30` | `fakeFetch` honours abort, records calls; e2e loopback server in `test/e2e.test.mjs:34` |
| Redaction + truncation | `bin/lib/redact.mjs` | `prepare(text, max)`; 13 classes listed one per line at `:5-17` |
| Harness output shapers and rule syntax | `bin/lib/harness.mjs:22-63` | the only place harness JSON shapes are known |
| Backlog/roadmap/issue tooling | `scripts/backlog.mjs`; `.github/workflows/backlog-issues.yml` | `ver=`, `<!-- hg:` markers; one-way sync to GitHub issues |
| Codex hooks writer | `bin/hookgate.mjs:139-146` (`print-hooks`) | substitutes `${PLUGIN_ROOT}` with the absolute checkout path |

---

## Existing tests

| What it covers | Path | How to run it |
|---|---|---|
| Manifests, hooks files, docs phrases, lib module presence (the `check` gate) | `bin/hookgate.mjs:80-116` | `npm test` (first half: `node bin/hookgate.mjs check`) |
| Command gate: no-key, passthrough, `allowMode` trust, repo tightening (HG-27), deny/ask shapes, Codex shapes, request body, timeout fail-open/closed, 529 + malformed (HG-29), audit logging, token usage (HG-28), cache, promotion, over-long (HG-26), non-promotable (HG-24/25); Stop once-per-prompt, `stop_hook_active`, prefilter; injection off by default | `test/handlers.test.mjs` (19 cases, `:12-215`) | `node --test test/handlers.test.mjs` |
| Deciders, thresholds, state builders (cwd shortening, git status), en/it prefilter, extra lexicon, bad regex swallowed (HG-23) | `test/gates.test.mjs` (11, `:9-47`) | `node --test test/gates.test.mjs` |
| Spawned binary: Claude deny/passthrough/stop, dead endpoint, bad stdin, doctor, Codex harness shapes, key only in `Authorization` | `test/e2e.test.mjs` (6, `:49-91`) | `node --test test/e2e.test.mjs` (loopback HTTP, no network) |
| Redaction classes, byte-identical ordinary commands, truncate marker | `test/redact.test.mjs` (3, `:5-20`) | `node --test test/redact.test.mjs` |
| Config layering and 12 invalid values, harness detection, `commandPrefix`/`promotablePrefix` (35 cases), `summarize`/`render` maths, doctor states, `print-hooks`, bad-key, log rotation, session atomicity/prune, `messageOutput` | `test/misc.test.mjs` (12, `:12-204`) | `node --test test/misc.test.mjs` |
| Scorecard runs without a key; `--compare` regression exit code | `test/scorecard.test.mjs` (2, `:12-25`) | `node --test test/scorecard.test.mjs` |
| Backlog parser, planner (8-action plan), lint (6 faults), roadmap render | `scripts/backlog_test.mjs:21-40` with `scripts/fixtures/` | `npm run backlog` |
| No-key fall-through under both root vars, from a shell | `.github/workflows/ci.yml:31-35` | CI only |
| Untested exported symbols (19): `COMMAND_QUESTIONS`, `COMPLETION_QUESTION`, `INJECTION_QUESTION`, `COMPLETION_LEXICONS`, `injectionState` (`gates.mjs`); `ENDPOINT`, `endpointFrom`, `JevError` (`jev.mjs`); `PRICE_PER_INPUT_TOKEN`, `PRICE_DATE`, `report` (`report.mjs`); `hash`, `cacheKey`, `cacheGet`, `cachePut`, `notePrefix` (`store.mjs`); `dataDir`, `stopOutput`, `postToolOutput` (`harness.mjs`); `userConfigPath` (`config.mjs`) | — | covered only indirectly through handlers/e2e; `hookgate report` and `help` subcommands have no test; no skipped/todo tests |

Total: 53 `test(` declarations across `test/*.test.mjs` (gates 11, e2e 6, misc 12, handlers 19, redact 3, scorecard 2).

---

## Blind spots

Things you could not determine, and why:

- Whether Claude Code's Stop stdin carries `prompt_id` or `turn_id`. `CLAUDE.md:114-122` lists neither; `handlers.mjs:105` falls back to `msg:<first 80 chars of last_assistant_message>`, so on Claude Code the "one block per prompt" key is probably the message prefix, and two different prompts ending in the same 80 characters would share a marker. Not verified against the live harness (no external fetch in this phase).
- Whether Claude Code accepts `{decision:'block', reason}` on Stop (what `harness.mjs:44` emits and `test/e2e.test.mjs:68` asserts) or `block: true` (what `CLAUDE.md:118` writes). The two documents inside the repo disagree; the code has never been run against a live Claude Code Stop in a test.
- Jev's actual agreement on the 79 commands: `evals/results/` holds only a baseline-only run of 10 `safe` commands; no Jev column exists anywhere (`BACKLOG.md:45-51` — blocked on a key).
- Whether `hookSpecificOutput.hookEventName` on a Codex `ask`-as-deny output (`harness.mjs:30`) is accepted by Codex; README claims a live 97%-confidence refusal on 0.155.1 (`README.md:138-141`) but that was a `deny`, not an `ask`-as-deny.
- How `Stop` behaves when `session_id` is missing: `store.mjs:44` maps it to `no-session`, so all such stops share one `blockedPrompts` list. Whether any harness omits `session_id` is unknown.
- The graph's line numbers (`graphify-out/graph.json`, rebuilt at `449e9d3`) lag HEAD by three commits; every line above was re-read from the files.

---

## Facts that contradict the assumptions

If research disproved an assumption from `00-questions.md`, write it here in large
letters. It is the most valuable output of the phase.

- **Q9 says `failClosed` is "never honoured from the repository file". The code lets the repository set it.** `bin/lib/config.mjs:47` — `failClosed: (t, r) => r === true` is in the `TIGHTEN` table, so a committed `.claude/hookgate.json` with `"failClosed": true` is accepted as a tightening. README agrees with the code (`README.md:70-77`, "may only tighten") and says nothing about excluding `failClosed`; no test covers the repo-sets-failClosed case (`test/handlers.test.mjs:34` checks mode/gates/model/timeout only).
- **Fail-closed `ask` fires in audit mode.** `bin/lib/handlers.mjs:56` returns `permissionOutput(…'ask'…)` whenever `cfg.failClosed && gate === 'command'`, with no check on `cfg.mode`. `CLAUDE.md:104` rule 7 says "audit mode never decides"; `README.md:47-51` describes audit as log-only. Combined with the previous point, a repository file can make audit-mode hookgate emit `ask` on every Jev outage.
- **Q1 "deny is emitted from the first release" holds only in enforce.** With the shipped default `mode: audit` (`config.mjs:15`), `handlers.mjs:88` returns null for every decision including `deny`; the CHANGELOG (`CHANGELOG.md:19-21`) and BACKLOG (`BACKLOG.md:45-47`) say so, the Q1 wording does not.
- **Q10 lists the detection order as "`PLUGIN_ROOT`, `HOOKGATE_HARNESS` or the stdin shape"; the code checks Claude's variables before Codex's.** `bin/lib/harness.mjs:10-14`: `HOOKGATE_HARNESS` → `CLAUDE_PLUGIN_ROOT|CLAUDE_PROJECT_DIR|CLAUDECODE` → `PLUGIN_ROOT|CODEX_HOME` → stdin. A Codex run inside a shell that still exports `CLAUDECODE` is detected as Claude; `doctor.mjs:19` calls `detectHarness(env)` with no stdin, so the stdin rule never applies to doctor.
- **The ticket's "handler reads `hook_event_name` from stdin" is not how dispatch works.** `bin/hookgate.mjs:46` dispatches on the argv name (`pre-tool-use`, `stop`, `post-tool-use`) from `hooks/hooks.json:7,15,22`; `hook_event_name` is only copied into the log (`handlers.mjs:39`).
- **Q6's "60 lines" is one of two caps.** `handlers.mjs:17` slices 60 lines, then `gates.mjs:84` truncates the result to 3,600 characters (30% of `maxStateChars`) — a long porcelain output loses its middle before the 60th line.
- **Q3 says labels were made "with a fixed synthetic cwd"; the dataset has no cwd.** `evals/commands.jsonl` records are `{command, label}` only; the cwd `/home/dev/projects/app` is added by `evals/run.mjs:39` at run time, so the label file itself is cwd-free.
- **Q8's "100% agreement" baseline is ten `safe` commands.** All 10 records in `evals/results/2026-09-22-commands-baseline-only.json` carry `label: safe` (`--limit 10` took the file head); the number says nothing about `ask`/`dangerous` handling and the README row (`README.md:150-158`) states n = 10 but not the label mix.
- **Docs disagree with each other and with the tree** (not with the answers, but a Design phase will trip on them): `CLAUDE.md:187` says 33 tests, there are 53; `CLAUDE.md:200` and `CONTRIBUTING.md:10` say "three manifests", `check` compares four (`bin/hookgate.mjs:88`); `CLAUDE.md:7` says Codex "from 0.2.0", `CHANGELOG.md:59-66` ships it in 0.0.3; `CLAUDE.md:118` writes Stop as `block: true`, code emits `decision: 'block'` (`harness.mjs:44`); `BACKLOG.md:139` (HG-16, open) still says the prefilter skips 81%, `README.md:175` retired that for 29%; the same corpus is 27,111 (`README.md:180`), 27,147 (`README.md:186`, `BACKLOG.md:184`) and 27,246 (`evals/results/2026-09-22-local.json`) commands; `CONTRIBUTING.md:69` says unreleased items are `ver=main`, `BACKLOG.md:26` uses `ver=0.0.3`.
- **Q4 "no per-repo off switch" is true for the repo file, but `HOOKGATE_CONFIG` is an unbounded switch.** `config.mjs:123-125` merges the `HOOKGATE_CONFIG` file untightened and skips the repo file entirely — any process that sets that variable (a wrapper, a CI job, a `direnv`) controls every field including `model` and `gates.*`. It is documented as trusted (`README.md:70-77`), so this is a scope fact, not a bug.

---

## Addendum — targeted round, 2026-09-23

Sources: the `.md` renderings of the pages (`curl https://code.claude.com/docs/en/hooks.md`, `…/permissions.md`, `https://learn.chatgpt.com/docs/hooks.md`, all HTTP 200, fetched 2026-09-23), quoted verbatim, plus one live probe. `WebFetch` on the same URLs returned a summary that contradicted the raw page in two places (a Stop `"ask"` decision, "auto mode converts ask to allow"); neither string exists in the raw page, so only the raw text is cited below.

### 1. Stop output shape (Claude Code) — settled

Claude Code honours `{"decision": "block", "reason": "…"}` on Stop; `block: true` is documented nowhere (`grep -c 'block: true\|"block": true' hooks.md` → 0). `harness.mjs:44` is right, `CLAUDE.md:118` is wrong.

> "`decision` | `"block"` prevents Claude from stopping. Omit to allow Claude to stop" / "`reason` | Required when `decision` is `"block"`. Tells Claude why it should continue" — https://code.claude.com/docs/en/hooks#stop-decision-control
> "Other events like PostToolUse and Stop continue to use top-level `decision` and `reason` as their current format." — same page, PreToolUse decision control note

### 2. `turn_id` / `prompt_id` / `session_id` in Claude Code input — settled

`session_id` and `prompt_id` are common input fields of every event (so Stop carries both); `turn_id` appears in exactly one event's table, `MessageDisplay` (a display-only event hookgate does not register), so no hookgate-registered Claude event carries `turn_id`. Caveat: `prompt_id` is "Absent until the first user input" and needs v2.1.196+, and the page's Stop example JSON omits it.

> "`session_id` | Current session identifier" / "`prompt_id` | UUID identifying the user prompt currently being processed. […] Absent until the first user input. Requires Claude Code v2.1.196 or later" — https://code.claude.com/docs/en/hooks#common-input-fields
> "In addition to the common input fields, MessageDisplay hooks receive identifiers for the turn and message […] `turn_id` | UUID of the current turn" — same page, MessageDisplay input (the only `turn_id` on the page: `grep -n turn_id hooks.md` → lines 1477, 1489)

### 3. Codex hook environment (repo-level `.codex/hooks.json`) — settled

Docs: `PLUGIN_ROOT`, `PLUGIN_DATA`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` are documented for **plugin-bundled** hooks only; no variable is documented for `~/.codex/hooks.json` or `<repo>/.codex/hooks.json`, and `CODEX_HOME` does not occur on the page (`grep -c CODEX_HOME hooks.md` → 0).

> "Plugin hook commands receive these environment variables: `PLUGIN_ROOT` is a Codex-specific extension that points to the installed plugin root. `PLUGIN_DATA` is a Codex-specific extension that points to the plugin's writable data directory. Codex also sets `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` for compatibility with existing plugin hooks." — https://learn.chatgpt.com/docs/hooks#plugin-bundled-hooks

Live probe, codex-cli 0.155.1, scratch repo with `.codex/hooks.json` = PreToolUse/`Bash` → `env | sort > hook-env.txt`, run `codex exec --approve-for-me --dangerously-bypass-hook-trust 'Run the shell command: echo probe' < /dev/null` (transcript shows `hook: PreToolUse` / `hook: PreToolUse Completed`, `echo probe` ran):
`PLUGIN_ROOT: absent`, `PLUGIN_DATA: absent`, `CODEX_HOME: absent`, `CLAUDECODE: present` (inherited — the parent shell had `CLAUDECODE=1`, no `CODEX_HOME`). The only `CODEX*` keys set were `CODEX_MANAGED_BY_NPM` and `CODEX_MANAGED_PACKAGE_ROOT`. So with a manifest-only install, `detectHarness` (`harness.mjs:10-14`) sees none of its Codex variables and, inside a Claude Code shell, reports `claude`; only the stdin rule can identify Codex.

### 4. Hook `ask` versus a matching `permissions.allow` rule (Claude Code) — settled by general statement

PreToolUse hooks run before permission evaluation and may "force a prompt"; the page spells out the allow-rule case explicitly only for blocking (exit 2), not for `"ask"`. Not probed live.

> "When Claude Code makes a tool call, PreToolUse hooks run before the permission prompt […]. The hook output can deny the tool call, force a prompt, or skip the prompt to let the call proceed." — https://code.claude.com/docs/en/permissions#extend-permissions-with-hooks
> "A blocking hook also takes precedence over allow rules. A hook that exits with code 2 stops the tool call before permission rules are evaluated, so the block applies even when an allow rule would otherwise let the call proceed." — same section
> "`"ask"` prompts the user to confirm." / "A hook's `"ask"` also forces a permission prompt in auto mode: the classifier can still deny the tool call, but it can't approve the call silently." — https://code.claude.com/docs/en/hooks#pretooluse-decision-control
> The converse is explicit: "a matching ask rule still prompts even when the hook returned `"allow"` or `"ask"`" — permissions page, same section

### 5. `hookSpecificOutput.hookEventName` on a Codex PreToolUse `deny` — settled (accepted), required-ness unresolved

The documented deny shape carries `"hookEventName": "PreToolUse"`; all 9 `hookSpecificOutput` examples on the page carry `hookEventName`, and no sentence marks it required or optional. Separately, Codex rejects `permissionDecision: "ask"` outright, so `codexAskAs === 'deny'` (`harness.mjs:30`) is the only shape that can work.

> `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Destructive command blocked by hook."}}` — "Codex also accepts this older block shape: `{"decision": "block", "reason": "…"}`" — https://learn.chatgpt.com/docs/hooks#pretooluse
> "`permissionDecision: "ask"`, legacy `decision: "approve"`, `continue: false`, `stopReason`, and `suppressOutput` are parsed but not supported yet. Codex marks the hook run as failed, reports the error, and continues the tool call." — same section

### 6. `session_id` on Stop — settled

Both harnesses document `session_id` on every event including Stop; neither documents a case where it is omitted. Codex Stop additionally carries `turn_id`, `stop_hook_active`, `last_assistant_message` (`string | null`).

> "Every command hook receives one JSON object on `stdin`. […] `session_id` | `string` | Current Codex session id. Subagent hooks use the parent session id." — https://learn.chatgpt.com/docs/hooks#common-input-fields; Stop table: "`turn_id` | `string` | Codex-specific extension. Active Codex turn id" — same page, Stop
> Claude Code: `session_id` is a common input field (item 2) and the Stop example JSON begins `"session_id": "abc123"` — https://code.claude.com/docs/en/hooks#stop

---

## Status

- [x] Research complete
- [x] Self-contained (explicit paths, no reference to session context)
- [x] Zero solution proposals
- [ ] Reviewed

> **Compression ratio:** ≈270k tokens burned (three Explore subagents reading all of `bin/`, `test/`, `evals/`, `scripts/`, the workflows and the six docs, plus the parent's verification pass) → ≈7k artifact tokens = ~38×
> Next phase: **Design**. It receives: this file + `00-questions.md` + the ticket.
