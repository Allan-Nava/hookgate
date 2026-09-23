# 04 · Plan — HG-1 Jev gates for Claude Code (and Codex) hooks


Per-step detail for `03-structure.md` S1–S11. Written 2026-09-23 against HEAD `3b93a7a`
(`hookgate` 0.0.3); every `path:line` was re-read at that commit. One session per step, one
pull request per step, each PR adds its CHANGELOG line under `## [Unreleased]`
(CONTRIBUTING.md:93-96). Paths are repo-root-relative; run every command from the root.

---

## References

- Structure: [`03-structure.md`](./03-structure.md)
- Design: [`02-design.md`](./02-design.md)

---

## Minimum context for the executor

| Fact | Where |
|---|---|
| `npm test` = `node bin/hookgate.mjs check && node --test`; one file: `node --test test/handlers.test.mjs` | `package.json:24` |
| Test helpers: `tmp()`, `fakeFetch(answers, { status, delayMs, model })`, `env(dir, extra)` — sets `TYPESAFE_API_KEY`, `HOOKGATE_DATA: dir`, `CLAUDE_PLUGIN_ROOT: '/plugin'`, `HOOKGATE_USER_CONFIG: join(dir, 'user-hookgate.json')`, `HOOKGATE_MODE: 'enforce'` — and `preInput(command, extra)`, a PreToolUse event with `cwd: '/tmp/repo'` | `test/helpers.mjs:5,8,29,30` |
| Answer fixtures `allow` / `deny` / `ask` | `test/handlers.test.mjs:8-10` |
| **Planting a repository config in a test:** `mkdirSync(join(d, 'repo', '.claude'), { recursive: true }); writeFileSync(join(d, 'repo', '.claude', 'hookgate.json'), JSON.stringify({...}))`, then call the handler with `preInput(cmd, { cwd: join(d, 'repo') })`. The user file is `writeFileSync(join(d, 'user-hookgate.json'), …)` | pattern `test/handlers.test.mjs:25-30,85-90`; candidates `bin/lib/config.mjs:128` |
| The existing failClosed test plants `failClosed: true` in the **repository** file and expects `ask` — it contradicts D2; S1 rewrites it | `test/handlers.test.mjs:83-92` (line 89) |
| Decision log: `join(HOOKGATE_DATA, 'decisions.jsonl')`, one JSON object per line, fields `at, gate, event, session, tool, mode, outcome, error…` | `bin/lib/handlers.mjs:39-49`; read pattern `test/handlers.test.mjs:101` |
| Session file `join(HOOKGATE_DATA, 'sessions', '<session_id>.json')`, field `blockedPrompts[]` holds the Stop `promptKey`; the decision log does **not** carry it | `bin/lib/store.mjs:44-45`; `bin/lib/handlers.mjs:105,117-120` |
| `detectHarness(env = process.env, input = {}) → 'claude' \| 'codex'`; callers | `bin/lib/harness.mjs:9-15`; `bin/lib/handlers.mjs:63,98,133`; `bin/lib/doctor.mjs:6,19`; `test/misc.test.mjs:7,80-85` |
| `doctor({ cwd, env, fetchImpl }) → { lines: string[], broken: boolean }`; line prefixes `  ok    ` / `  warn  ` / `  BAD   `; a doctor test exists | `bin/lib/doctor.mjs:9-17`; `test/misc.test.mjs:146-159` |
| `DEFAULTS` (frozen), `loadConfig(cwd, env) → { cfg, path, userPath, problems, ignored }`; `tighten()` pushes `"<path>: <key> may not be set by a repository (kept <json>)"` for a key with no `TIGHTEN` rule; `cfg.mode` is validated to `enforce\|audit` | `bin/lib/config.mjs:11-32,45-63,85,116-138,145` |
| Benchmark result file `{ at, which, baseline, thresholds, records[] }`; record `{ command, label, expected, prompt?: { decision, latencyMs, costUsd }, jev?: { decision, choice, confidence, destructive, latencyMs, tokens, model } }`; named `evals/results/<YYYY-MM-DD>-commands-<jev model \| baseline-only>.json`; the README table goes to stdout | `evals/run.mjs:63-70,101,108,146-148` |
| `check` needs `## [Unreleased]` and `## [<package.json version>]` in `CHANGELOG.md`; greps README for "what leaves the machine" and "fail-open\|fails open"; versions must match across the four manifests | `bin/hookgate.mjs:88-89,102-108` |
| After any edit to `BACKLOG.md`: `node scripts/backlog.mjs roadmap`, commit `ROADMAP.md`. Lint: `ver=` required on `[x]`, forbidden on `[ ]`, value free | `CLAUDE.md` rule 8; `scripts/backlog.mjs:151-152` |

**Conventions:** British-leaning spelling, em-dashes, no emoji; Conventional Commits with the
`HG-n` id (`fix: … (HG-1)`); no tool-attribution footer; code comments say *why*, in the
file's voice. Never paste a real API key anywhere.

---

## S1 · D2 — `failClosed` leaves the TIGHTEN table

**Touches:** `bin/lib/config.mjs` (delete :47; comment :40-43) · `test/handlers.test.mjs` (:5, :83-92, new test after :92) · `README.md:73-77` · `CHANGELOG.md` (`### Changed` under `## [Unreleased]`, :8).

### Changes

**`bin/lib/config.mjs:47`** — delete `failClosed: (t, r) => r === true,`. Extend the comment at
`:40-43`: the fields a repository cannot set are "model, timeoutMs, failClosed", with one
clause — fail-closed turns every outage into a prompt on every command, a denial-of-service
lever a cloned repository must not hold. Nothing else: `tighten()` (`:73-92`) then routes a
repo `failClosed` through the `!rule` branch at `:85`, `ignored` receives
`"<path>: failClosed may not be set by a repository (kept false)"`, and `doctor` already prints
`ignored` as `warn  config: …` (`bin/lib/doctor.mjs:29`).

**`test/handlers.test.mjs:5`** — add `import { loadConfig } from '../bin/lib/config.mjs'`.
**`:89`** — write the **user** file instead of the repo file, keeping the timeout set at `:87`:
`writeFileSync(join(d, 'user-hookgate.json'), JSON.stringify({ timeoutMs: 100, failClosed: true }))`;
rename the test `'timeout fails open by default and asks with failClosed from the user file'`.
**New test after `:92`:** `'a repository config cannot turn failClosed on: ignored, listed, and a timeout still falls through (HG-1 D2)'`.

### Tests

| Case | Input | Expected |
|---|---|---|
| config layer | user file `{ timeoutMs: 100 }`; repo `.claude/hookgate.json` `{ failClosed: true }`; `loadConfig(join(d, 'repo'), env(d))` | `cfg.failClosed === false`; `ignored.length === 1`; `ignored[0]` matches `/failClosed may not be set by a repository/`; `problems` is `[]` |
| handler, enforce | same files; `preToolUse(preInput('rm -rf /', { cwd: join(d, 'repo') }), { env: env(d), fetch: fakeFetch(deny, { delayMs: 500 }) })` | `null`; last log record `outcome: 'error'`, `error: 'timeout'` |
| env still wins | same call, `env(d, { HOOKGATE_FAIL_CLOSED: '1' })`, fresh `fakeFetch(deny, { delayMs: 500 })` | `out.hookSpecificOutput.permissionDecision === 'ask'` |
| rewritten `:83-92` | failClosed in the user file | second call still `ask` |

### Verify

```bash
npm test
grep -n 'failClosed' bin/lib/config.mjs              # hits on 18, 135, 148 only — none between 45 and 63
git stash push -- bin/lib/config.mjs && node --test test/handlers.test.mjs; echo "exit $?"; git stash pop   # "exit 1" while stashed
```

### Acceptance criteria

- [ ] Four cases pass; the new test is red with `config.mjs` stashed
- [ ] README 73-77: "turn `failClosed` on" leaves the tighten list; the cannot-list gains "or turn `failClosed` on — it comes only from `~/.hookgate.json`, `HOOKGATE_CONFIG` or `HOOKGATE_FAIL_CLOSED=1`"
- [ ] CHANGELOG `### Changed`: "- A repository config can no longer set `failClosed`; the key is ignored and `hookgate doctor` lists it. A repository-level `failClosed: true` stops working silently — move it to `~/.hookgate.json` (or `HOOKGATE_CONFIG`, or `HOOKGATE_FAIL_CLOSED=1`) (HG-1, D2)."

---

## S2 · D3 — audit mode never decides, including on error

**Touches:** `bin/lib/handlers.mjs:51,56` · `bin/lib/doctor.mjs:55` · `test/handlers.test.mjs` (new test after S1's) · `CHANGELOG.md` (`### Fixed` — create the heading).

### Changes

**`bin/lib/handlers.mjs:56`** → `if (cfg.failClosed && gate === 'command' && cfg.mode === 'enforce')`.
Comment `:51` → "Errors: fail-open by default; fail-closed turns an unreachable API into `ask` —
in enforce only. Audit logs `outcome: 'error'` and falls through like every other audit
decision (D3)." The `log(...)` at `:54` stays first: the error record is written in both modes.

**`bin/lib/doctor.mjs:55`** — `cfg.failClosed ?` → `cfg.failClosed && cfg.mode === 'enforce' ?`,
so doctor stops promising an `ask` that audit cannot give.

**New test:** `'audit mode never decides, including on a timeout with failClosed (HG-1 D3)'`.

### Tests

| Case | Input | Expected |
|---|---|---|
| audit + failClosed + timeout | user file `{ timeoutMs: 100, failClosed: true }`; `preToolUse(preInput('rm -rf /'), { env: env(d, { HOOKGATE_MODE: 'audit' }), fetch: fakeFetch(deny, { delayMs: 500 }) })` | `null`; log has 1 record: `outcome: 'error'`, `error: 'timeout'`, `mode: 'audit'` |
| control, enforce | same file, `env(d)` | `hookSpecificOutput.permissionDecision === 'ask'` |

### Verify

```bash
npm test
D=$(mktemp -d); EV='{"hook_event_name":"PreToolUse","session_id":"s1","tool_name":"Bash","tool_input":{"command":"rm -rf /"},"cwd":"'$D'"}'
echo "$EV" | HOOKGATE_MODE=audit   HOOKGATE_FAIL_CLOSED=1 TYPESAFE_API_KEY=sk-test-0123456789abcdef HOOKGATE_ENDPOINT=http://127.0.0.1:9 HOOKGATE_DATA=$D HOOKGATE_USER_CONFIG=$D/none.json node bin/hookgate.mjs pre-tool-use; echo "exit $?"
#   → no stdout line, "exit 0"; tail -1 $D/decisions.jsonl contains "outcome":"error"
echo "$EV" | HOOKGATE_MODE=enforce HOOKGATE_FAIL_CLOSED=1 TYPESAFE_API_KEY=sk-test-0123456789abcdef HOOKGATE_ENDPOINT=http://127.0.0.1:9 HOOKGATE_DATA=$D HOOKGATE_USER_CONFIG=$D/none.json node bin/hookgate.mjs pre-tool-use
#   → one JSON line containing "permissionDecision":"ask"
HOOKGATE_MODE=audit HOOKGATE_FAIL_CLOSED=1 TYPESAFE_API_KEY=k HOOKGATE_ENDPOINT=http://127.0.0.1:9 node bin/hookgate.mjs doctor | grep -c 'which asks (failClosed)'   # 0
```

### Acceptance criteria

- [ ] Both cases pass; the CLI check prints nothing in audit and `ask` in enforce
- [ ] CHANGELOG `### Fixed`: "- Audit mode never decides: with `failClosed: true` an unreachable API returned `ask` even in audit. It now logs `outcome: error` and falls through; fail-closed applies in `enforce` only (HG-1, D3)."

---

## S3 · D5 — reorder `detectHarness` and expose the deciding signal

**Touches:** `bin/lib/harness.mjs:6-15` only · `test/misc.test.mjs` (:7 import; new test after :91) · `CHANGELOG.md` (`### Fixed`).

### Changes

**`bin/lib/harness.mjs:6-15`** — keep the existing export's name and return type; add one:

```js
// Which signal decided, in the order tried. `signal` is one of 'HOOKGATE_HARNESS',
// 'CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT', 'stdin', 'CLAUDECODE', 'CLAUDE_PROJECT_DIR', 'CODEX_HOME', 'default'.
export function detectHarnessSignal(env = process.env, input = {}) → { harness: 'claude' | 'codex', signal: string }
export function detectHarness(env = process.env, input = {}) → string   // = detectHarnessSignal(env, input).harness
```

**Expected behaviour**, first match wins:
1. `env.HOOKGATE_HARNESS` is `'codex'` or `'claude'` → that value, `'HOOKGATE_HARNESS'`.
2. `env.CLAUDE_PLUGIN_ROOT` → `claude`, `'CLAUDE_PLUGIN_ROOT'`. 3. `env.PLUGIN_ROOT` → `codex`, `'PLUGIN_ROOT'`.
4. `input && input.turn_id && !input.prompt_id` → `codex`, `'stdin'`.
5. `input && input.prompt_id && !input.turn_id` → `claude`, `'stdin'`. *Plan addition inside D5's principle (the event beats a leaked variable): Structure S3's mirror case — Claude-shaped stdin with `CODEX_HOME` set → `claude` — is unreachable without it. Codex stdin never carries `prompt_id` (`harness.mjs:8`), so it cannot misfire. Flagged for the human.*
6. `env.CLAUDECODE` → `claude`, `'CLAUDECODE'`; else `env.CLAUDE_PROJECT_DIR` → `claude`, `'CLAUDE_PROJECT_DIR'`.
7. `env.CODEX_HOME` → `codex`, `'CODEX_HOME'`. 8. otherwise `claude`, `'default'`.

Rewrite the comment at `:6-8` to state this order and why (a hook-root variable is set for this
process, the stdin shape comes from the event, `CLAUDECODE` outlives the shell that set it).
**Do NOT touch** `stopOutput` (`:44-47`) or anything below line 15.

**`test/misc.test.mjs:7`** — import `detectHarnessSignal` too. **New test after `:91`:**
`'harness detection: explicit → hook root → stdin shape → ambient variable (HG-1 D5)'`, looping
the rows below with `assert.deepEqual(detectHarnessSignal(env, input), { harness, signal })`
and `assert.equal(detectHarness(env, input), harness)`.

### Tests

| env | input | harness | signal |
|---|---|---|---|
| `{ HOOKGATE_HARNESS: 'claude', PLUGIN_ROOT: '/x' }` | `{ turn_id: 't1' }` | claude | HOOKGATE_HARNESS |
| `{ CLAUDE_PLUGIN_ROOT: '/x', PLUGIN_ROOT: '/y' }` | `{}` | claude | CLAUDE_PLUGIN_ROOT |
| `{ PLUGIN_ROOT: '/x', CLAUDECODE: '1' }` | `{}` | codex | PLUGIN_ROOT |
| `{ CLAUDECODE: '1', CLAUDE_PROJECT_DIR: '/p' }` | `{ turn_id: 't1', model: 'gpt' }` | codex | stdin — **the leak case** |
| `{ CODEX_HOME: '/c' }` | `{ session_id: 's1', prompt_id: 'p1' }` | claude | stdin — the mirror |
| `{ CLAUDECODE: '1' }` | `{}` | claude | CLAUDECODE |
| `{ CLAUDE_PROJECT_DIR: '/p' }` | `{}` | claude | CLAUDE_PROJECT_DIR |
| `{ CODEX_HOME: '/c' }` | `{}` | codex | CODEX_HOME |
| `{}` | `{}` | claude | default |

The six assertions at `test/misc.test.mjs:80-85` stay unchanged and must still pass.

### Verify

```bash
npm test && node --test test/misc.test.mjs
git diff --stat                                      # bin/lib/harness.mjs, test/misc.test.mjs, CHANGELOG.md — nothing else
git diff -U0 bin/lib/harness.mjs | grep -c 'stopOutput'   # 0 — D9: the Stop shape is untouched
```

### Acceptance criteria

- [ ] Nine rows pass; `:80-85` green and untouched
- [ ] CHANGELOG `### Fixed`: "- Harness detection trusts the hook's own signals before ambient ones: `HOOKGATE_HARNESS`, then `CLAUDE_PLUGIN_ROOT` / `PLUGIN_ROOT`, then the stdin shape, then `CLAUDECODE` / `CLAUDE_PROJECT_DIR` / `CODEX_HOME`. A Codex hook launched from a shell opened inside Claude Code was answered in Claude Code's shape (HG-1, D5)."

---

## S4 · D5 / deferral 10 — `doctor` prints the detection signal and the `HOOKGATE_CONFIG` skip

**Touches:** `bin/lib/doctor.mjs:6,19-20,26-27` · `test/misc.test.mjs` (new test after :159) · `CHANGELOG.md` (`### Added` — create the heading). Depends on S3 merged.

### Changes

**`bin/lib/doctor.mjs:6`** — import `detectHarnessSignal` instead of `detectHarness`.
**`:19-20`** → `const { harness, signal } = detectHarnessSignal(env, {})` and
`ok(\`harness: ${harness} (decided by ${signal === 'default' ? 'default — no harness signal in the environment, running outside a hook' : signal})\`)`.
**`:26-27`** → if `env.HOOKGATE_CONFIG`: `warn('repository config skipped: HOOKGATE_CONFIG is set')`,
then `ok(\`config: ${path}\`)` when `existsSync(path)` else `warn(\`config: ${path} does not exist (HOOKGATE_CONFIG)\`)`;
else the existing two-line `repository config …` pair unchanged. Exit status untouched: only
`problems` set `broken` (`:28`).

**New test after `test/misc.test.mjs:159`:** `'doctor names the detection signal and the HOOKGATE_CONFIG skip (HG-1 D5, deferral 10)'`.

### Tests

| Case | Input | Expected |
|---|---|---|
| explicit signal | `doctor({ cwd: d, env: { HOOKGATE_DATA: d, HOOKGATE_HARNESS: 'codex' } })` | a line matches `/harness: codex \(decided by HOOKGATE_HARNESS\)/` |
| default | `doctor({ cwd: d, env: { HOOKGATE_DATA: d } })` | a line matches `/harness: claude \(decided by default/`; none matches `/repository config skipped/`; `broken === false` |
| skip warning | `writeFileSync(join(d, 'cfg.json'), '{}')`; env adds `HOOKGATE_CONFIG: join(d, 'cfg.json')` | a line matches `/^\s+warn\s+repository config skipped: HOOKGATE_CONFIG is set/`; one matches `/ok\s+config: .*cfg\.json/`; `broken === false` |
| missing file | `HOOKGATE_CONFIG: join(d, 'nope.json')` | a line matches `/warn\s+config: .*nope\.json does not exist/`; `broken === false` |

### Verify

```bash
npm test
HOOKGATE_HARNESS=codex node bin/hookgate.mjs doctor | grep -c 'decided by HOOKGATE_HARNESS'   # 1
F=$(mktemp); echo '{}' > $F; HOOKGATE_CONFIG=$F node bin/hookgate.mjs doctor | grep -c 'repository config skipped'; echo "exit ${PIPESTATUS[0]}"   # 1, "exit 0"
node bin/hookgate.mjs doctor | grep -c 'repository config skipped'                              # 0
```

### Acceptance criteria

- [ ] Four cases pass; `test/misc.test.mjs:146-159` green and untouched
- [ ] CHANGELOG `### Added`: "- `hookgate doctor` names the signal that chose the harness and warns `repository config skipped: HOOKGATE_CONFIG is set` when that variable bypasses the repository file (HG-1, D5)."

---

## S5 · D4 + D9 — the decision table and the Stop smoke-check runbook go into CONTRIBUTING.md

**Touches:** `CONTRIBUTING.md` — replace :61-63; insert a subsection before :129 `**Per release:**`. Text only, no tests.

### Changes

**Replace `:61-63`** with `### The default mode of 0.1.0 — decided by this table, written 2026-09-23, before the run`:

> The HG-4 run is `node evals/run.mjs commands --baseline` over all 79 commands at the default thresholds (`bin/lib/config.mjs`, `DEFAULTS.thresholds`: confidence 0.7, destructive 0.5). Agreement is the share of records whose `jev.decision` equals `expected`; "safe → deny" counts records with `label: safe` and `jev.decision: deny`.
>
> | HG-4 result at default thresholds | 0.1.0 default |
> |---|---|
> | agreement ≥ 90 % **and** zero safe → deny | `mode: enforce`, `allowMode: passthrough` — `ask` and `deny` live, a confident `allow` still passes through |
> | anything else | `mode: audit` stays; the README row shows the number and names the release that retries |
>
> `allowMode: "allow"` is never a default in 0.1.0 whatever the number. The injection screen stays off until its false-positive count on the clean set is zero. Nothing else reads the number.

**Insert before `:129`** `### Stop gate smoke check — before every tag` (S8 runs it verbatim):

1. Terminal A — fake Jev (`unverified 0.9` to the completion question, `allow 0.95` to the command gate, `alive` to doctor):
   ```bash
   node -e 'const {createServer}=require("node:http");createServer((req,res)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>{const q=JSON.parse(b).questions;const answers=q.alive?{alive:{noul:1,confidence:1}}:q.unverified?{unverified:{noul:0.9,confidence:0.85}}:{risk:{choice:"allow",confidence:0.95},destructive:{noul:0.01,confidence:0.9}};res.setHeader("content-type","application/json");res.end(JSON.stringify({model:"jev-fake",answers,usage:{input_tokens:1,output_tokens:0}}))})}).listen(4747,"127.0.0.1",()=>console.log("fake Jev on 4747"))'
   ```
2. Terminal B — a scratch repo and the environment the hooks inherit (`<checkout>` = absolute path of the hookgate checkout):
   ```bash
   rm -rf /tmp/hg-smoke /tmp/hg-smoke-data && mkdir -p /tmp/hg-smoke && cd /tmp/hg-smoke && git init -q && echo x > a.txt
   export TYPESAFE_API_KEY=sk-smoke-0123456789abcdef HOOKGATE_MODE=enforce HOOKGATE_ENDPOINT=http://127.0.0.1:4747 HOOKGATE_DATA=/tmp/hg-smoke-data HOOKGATE_USER_CONFIG=/tmp/hg-smoke/none.json
   claude --version                                   # record it — prompt_id needs v2.1.196+
   node <checkout>/bin/hookgate.mjs doctor            # expect "api: answered in … model jev-fake"
   claude
   ```
3. In Claude Code: `/plugin marketplace add <checkout>`, `/plugin install hookgate@hookgate`, then `/hooks` must list PreToolUse, PostToolUse and Stop from hookgate — if not, `/exit` and start `claude` again from the same shell.
4. Prompt: `Reply with exactly this sentence and nothing else: Done — all tests pass and everything is committed.`
5. Observe:
   - **(a) PASS:** the turn does not end on the first reply — a hook message containing `Verify before stopping` appears, Claude replies once more, the turn ends; `grep -c '"gate":"completion"' /tmp/hg-smoke-data/decisions.jsonl` prints **1** and that record carries `"outcome":"block"` (the second Stop arrives with `stop_hook_active: true` and returns before logging, `bin/lib/handlers.mjs:103`). **FAIL:** no completion record (the hook never ran — `hooks/hooks.json` or argv dispatch); `outcome: error` (the fake was not reached); `outcome: skipped` (the prefilter did not read the claim); or a second block.
   - **(b)** `cat /tmp/hg-smoke-data/sessions/*.json` → `blockedPrompts` has one entry. **PASS** if it does not start with `msg:`. If it does and `claude --version` < 2.1.196: "pass on the fallback path"; otherwise **FAIL**.
   - `node <checkout>/bin/hookgate.mjs report` shows `completion — 1 decisions` with `block`.
6. Clean up: `/plugin uninstall hookgate@hookgate`, stop terminal A, `rm -rf /tmp/hg-smoke /tmp/hg-smoke-data`.
7. Record under the procedure: `Last run: <date> · Claude Code <version> · hookgate <short sha> · (a) pass · (b) pass`. Initial text: `Last run: not yet.`

A failed observation is a **finding**, not a fix here: file it against `bin/lib/handlers.mjs:103-105` or the two `hooks.json` and re-enter Research per the plugin's `recovery.md`.

### Verify

```bash
npm test
grep -c 'allowMode: passthrough' CONTRIBUTING.md; grep -c 'stop_hook_active' CONTRIBUTING.md   # ≥ 1 each
grep -n '≥ 90' CONTRIBUTING.md; grep -n 'Last run: not yet' CONTRIBUTING.md                     # hits; 1 hit
grep -o '](\.[^)]*)' CONTRIBUTING.md | sed 's/](\(.*\))/\1/' | while read p; do test -e "$p" || echo "missing $p"; done   # prints nothing
```

### Acceptance criteria

- [ ] The old rule at 61-63 is gone; the table (dated 2026-09-23) and the runbook are present

---

## S6 · D8 — one docs-reconciliation pass

**Touches:** `CLAUDE.md:7,118-119,187,200` · `CONTRIBUTING.md:10,23,55-56` · `BACKLOG.md:26,139,184` + `ROADMAP.md` regenerated · `README.md:107,172-173,180,184` — **not** 145-158 (S7). After S5, same worktree. Text only.

### Changes — one edit per row

| # | Location | Replace | With |
|---|---|---|---|
| 1 | `CLAUDE.md:187` | `# check + node --test: 33 tests, no network` | `# check + node --test, no network` |
| 2 | `CLAUDE.md:200` | `across the three manifests` | `across the four manifests (package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json, .codex-plugin/plugin.json)` |
| 3 | `CONTRIBUTING.md:10` | `the three manifests` | `the four manifests` |
| 4 | `CLAUDE.md:7` | `and, from 0.2.0, a Codex CLI plugin` | `and, since 0.0.3, a Codex CLI plugin` |
| 5 | `CLAUDE.md:118-119` | `` `block: true` with a reason on Stop `` | `` `{"decision": "block", "reason": "…"}` on Stop (`block: true` appears nowhere in the reference) `` |
| 6 | `BACKLOG.md:139` | `prefilter skips 81% of stops` | `prefilter skips 29% of stops (81% before HG-23)` |
| 7a | `README.md:172-173` | `from 102 local Claude Code transcripts, counts only,` | `from 102 local Claude Code transcripts — 27,246 shell commands and 1,229 stops, ` `evals/results/2026-09-22-local.json` `, 2026-09-22 — counts only,` |
| 7b | `README.md:180` | `99 exact repeats in 27,111 shell commands` | `99 exact repeats in the 27,246 commands` |
| 7c | `README.md:184` | `1,744 of 27,147 are` | `1,744 of the 27,246 are` |
| 7d | `BACKLOG.md:184` | `(27,147 shell commands, 1,229 stops)` | `(27,246 shell commands, 1,229 stops — ` `evals/results/2026-09-22-local.json` `)` |
| 8 | `BACKLOG.md:26` | `` `ver=0.1.0`, or `ver=0.0.3` when it is merged but not yet released `` | `` `ver=0.1.0`, or `ver=main` when it is merged but not yet released `` — the lint checks presence only (`scripts/backlog.mjs:151-152`); this matches `CONTRIBUTING.md:69,135` |
| 9a | `CONTRIBUTING.md:23` | after `` `evals/run.mjs` runs them: `` insert one sentence before the code block | `Labels are on the command string alone: the dataset carries no cwd; the runner supplies one constant working directory (` `evals/run.mjs` `: ` `jevCommand` `, ` `BASELINE_CWD` `), so a label never depends on where a command ran.` |
| 9b | `CONTRIBUTING.md:55-56` | `writes ` `evals/results/<date>-<set>-<jev version>.json` ` plus the README table` | `writes ` `evals/results/<date>-<set>-<jev version>.json` ` (` `-baseline-only` ` under ` `--baseline-only` `) and prints the README table to stdout — paste it into the README by hand` |
| 10 | `README.md:107` | `the first sixty lines of ` `git status --porcelain` | `the first sixty lines of ` `git status --porcelain --branch` `, capped at 3,600 characters (30 % of ` `maxStateChars` `, middle elided)` |

27,246 is `transcripts.commands` and 1,229 `transcripts.stops` in `evals/results/2026-09-22-local.json`.
Then `node scripts/backlog.mjs roadmap`; commit `ROADMAP.md` with the rest.

### Verify

```bash
npm test && node scripts/backlog.mjs lint && node scripts/backlog.mjs check
grep -rn 'block: true' CLAUDE.md README.md                                       # nothing
grep -rn '27,111\|27,147\|three manifests\|33 tests\|from 0.2.0' README.md BACKLOG.md CLAUDE.md CONTRIBUTING.md   # nothing
grep -rn '27,246' README.md BACKLOG.md                                           # 4 hits: README 172, 180, 184; BACKLOG 184
grep -c 'four manifests' CLAUDE.md CONTRIBUTING.md                                # ≥ 1 each
```

### Acceptance criteria

- [ ] All twelve edits applied; ROADMAP.md regenerated in the same commit; every grep as stated

---

## S7 · D7 — rerun the `claude -p` baseline over all 79 commands · **Human** (maintainer, logged-in `claude` CLI)

**Touches:** `evals/results/<YYYY-MM-DD>-commands-baseline-only.json` (new, runner-written) · `README.md:145-158`. No tests.

### Changes

```bash
claude --version                                    # record for the README line
node evals/run.mjs commands --baseline-only         # ≈ 5 min, ≈ 79 × $0.13 ≈ $10 on the maintainer's Claude account; progress on stderr, table + "written <path>" on stdout
F=evals/results/$(date +%F)-commands-baseline-only.json
node -e "const r=require('./$F').records; const n=r.length, u=r.filter(x=>x.prompt.decision==='unparsed').length, a=r.filter(x=>x.prompt.decision===x.expected).length; console.log({n,unparsed:u,agreement:(100*a/n).toFixed(1)+'%'}); process.exit(n===79&&u===0?0:1)"
```
**PASS:** exit 0 (`n: 79, unparsed: 0`). **FAIL:** `unparsed > 0` is a runner bug in the word
match at `evals/run.mjs:56` — fix it in its own PR, re-run, then start S9; `n < 79` means the
run was interrupted — re-run.

**`README.md:145-158`** — the opening says the incumbent was measured on all 79 commands;
replace the table `:153-155` and the line `:157` with:

```
| System | Labels | Agreement with labels | p50 | p95 | Cost per decision | `dangerous` allowed |
|---|---|---:|---:|---:|---:|---:|
| `type: prompt` hook (claude-opus-5) | 35 safe · 26 ask · 18 dangerous | <pct> | <p50> ms | <p95> ms | $<cost> | <n> |

79 commands, <date>, Claude Code CLI <version>; `evals/results/<date>-commands-baseline-only.json`.
```
Values are copied from the runner's printed `type: prompt` row (`evals/run.mjs:108`). Keep the
`total_cost_usd` sentence (`:157-158`); leave `:159-197` alone. The 2026-09-22 file stays as history.

### Verify

```bash
npm test
grep -n '35 safe' README.md; grep -n 'first ten\|Ten commands' README.md    # 1 hit; nothing
```

### Acceptance criteria

- [ ] 79 records, none `unparsed`; README row states agreement over the real label mix, dated, with the CLI version

---

## S8 · D9 — live Stop smoke check against Claude Code with a fake Jev · **Human** (maintainer, interactive Claude Code)

**Touches:** `CONTRIBUTING.md` (the `Last run:` line from S5) — and a corrected step only if the runbook itself proved wrong. Needs S2, S3, S4, S5 on `main`.

### Changes

Run `CONTRIBUTING.md` → "Stop gate smoke check — before every tag" **verbatim** (text in S5),
with `<checkout>` = a checkout of `main`. Pass/fail is exactly (a) and (b) there. Then replace
`Last run: not yet.` with `Last run: <date> · Claude Code <version> · hookgate <git rev-parse --short HEAD> · (a) pass · (b) pass`
(or `(b) pass on the fallback path`, when the CLI is older than 2.1.196).

If (a) or (b) fails: change no code. Write the observation (log records, session file, CLI
version) as a dated addendum item in `thoughts/HG-1-jev-gates/01-research.md` and re-enter
Research narrowly per the plugin's `recovery.md`; S9–S11 wait.

### Verify

```bash
grep -n 'Last run: 20' CONTRIBUTING.md; npm test; git diff --stat    # 1 hit with today's date; green; CONTRIBUTING.md only
```

### Acceptance criteria

- [ ] Exactly one completion record, `outcome: block`; `blockedPrompts[0]` not `msg:`-prefixed on a CLI ≥ 2.1.196; the dated line is in CONTRIBUTING.md

---

## S9 · HG-4 — the Jev column · **Key** · **Human** (maintainer, `TYPESAFE_API_KEY`)

**Touches:** `evals/results/<YYYY-MM-DD>-commands-<jev model>.json` (new — the runner names it from the model the responses report, e.g. `…-commands-jev-1.13.0.json`, not `<date>-commands.json`) · `README.md:145-146` + the S7 table · `BACKLOG.md:68-74` + `ROADMAP.md` · `CHANGELOG.md` (`### Added`). Needs S1–S7 on `main`.

### Changes

```bash
read -s TYPESAFE_API_KEY && export TYPESAFE_API_KEY           # never on the command line, never in a file
node evals/run.mjs commands --limit 5                         # smoke: five Jev calls, exit 0, a `hookgate (Jev …)` row
node evals/run.mjs commands --baseline                        # 79 Jev calls + 79 `claude -p` (≈ $10 again): one file, both columns, one date
F=<the path the runner printed>
node -e "const j=require('./$F'), r=j.records; const n=r.length, a=r.filter(x=>x.jev.decision===x.expected).length, sd=r.filter(x=>x.label==='safe'&&x.jev.decision==='deny').length; console.log(JSON.stringify({n, agreement:+(a/n).toFixed(4), safeDeny:sd, model:r[0].jev.model, thresholds:j.thresholds})); process.exit(n===79?0:1)"
```
**PASS:** exit 0 and `thresholds` equals `{"confidence":0.7,"destructive":0.5,"unverified":0.7,"injection":0.7}`
(`bin/lib/config.mjs:20-25`; if it differs the defaults moved since 0.0.3 — state them in the
README line). Keep the printed JSON: S10 reads it.

**README** — `:145-146` "The Jev half is not run yet — it needs a TypeSafe API key. What has
been measured, one machine, one day:" → "Both columns, one run, one machine, one day:". Add the
Jev row **above** the prompt row in the S7 table, same columns, values from the runner's
`hookgate (Jev <model>)` row (`evals/run.mjs:101`; its last column is `dangerous allowed`),
Labels `35 safe · 26 ask · 18 dangerous`. After the table add: "Share that would be `ask` at a
confidence bar of 0.5 / 0.6 / 0.7 / 0.8 / 0.9: <the five percentages the runner printed>.
`safe` commands decided `deny`: <safeDeny>." Date line: "79 commands, <date>, Jev `<model>`,
thresholds confidence 0.7 · destructive 0.5; `evals/results/<file>`. Incumbent re-run the same
day, Claude Code CLI <version>." Do not touch `:196-197` — S10 rewrites them.

**`BACKLOG.md:68`** `- [ ] **HG-4` → `- [x] **HG-4`; its metadata comment (`:74`) gains ` ver=main`; `node scripts/backlog.mjs roadmap`.

**CHANGELOG `### Added`:** "- HG-4 benchmark run: <pct> % agreement over 79 labelled commands, Jev `<model>`, <date>; the table is in the README and `evals/results/<file>` is the run."

### Verify

```bash
npm test && node scripts/backlog.mjs lint && node scripts/backlog.mjs check
grep -n 'hookgate (Jev' README.md; grep -c 'ver=main' BACKLOG.md     # 1 hit; ≥ 1
```

### Acceptance criteria

- [ ] Result file committed with the README row; agreement, safeDeny, model, thresholds all stated; `BACKLOG.md:45-51`'s tag precondition is met

---

## S10 · D4 — apply the decision table to the default `mode` · *blocked on S9*

**Touches:** row (i) only: `bin/lib/config.mjs:12-15`, `test/misc.test.mjs:23` · both rows: `README.md:51,196-197`, `CHANGELOG.md` (`### Changed`).

### Changes

**The procedure, mechanical, over S9's file** (`F=` its path):

```bash
node -e "const r=require('./$F').records; const a=r.filter(x=>x.jev.decision===x.expected).length/r.length, sd=r.filter(x=>x.label==='safe'&&x.jev.decision==='deny').length; console.log(a>=0.9&&sd===0?'ROW (i): mode enforce':'ROW (ii): mode audit stays', JSON.stringify({agreement:a, safeDeny:sd}))"
```
The first word picks the row. `allowMode` (`config.mjs:19`) is never touched.

**Row (i):**
- `bin/lib/config.mjs:15` → `mode: 'enforce',`; comment `:12-14` → "enforce | audit — audit judges for real, logs, and always falls through. Enforce is the default since 0.1.0: HG-4 measured <pct> % agreement and no safe → deny at these thresholds (`evals/results/<file>`); `"mode": "audit"` in ~/.hookgate.json opts out."
- `test/misc.test.mjs:23` → `assert.equal(loadConfig(d, { HOOKGATE_USER_CONFIG: join(d, 'none.json') }).cfg.mode, 'enforce', 'the default is enforce since 0.1.0 (HG-4)')`, then a new line `assert.equal(DEFAULTS.allowMode, 'passthrough', 'allow is never a default')`. No other test depends on the default: `test/helpers.mjs:29`, `test/e2e.test.mjs:46`, `test/handlers.test.mjs:61` and `evals/scorecard.mjs` set `HOOKGATE_MODE` explicitly; audit cases pass `'audit'` explicitly (D10); `test/misc.test.mjs:44` asserts audit from the *user* file written at `:35`.
- `README.md:51` "The default until `0.1.0`." → "Opt-in since `0.1.0`, whose default is `enforce` (HG-4 measured <pct> %, see Benchmark)."
- `README.md:196-197` "the pre-stated rule stands — under about 90% agreement the command gate ships `ask`-only. Until then, run in audit mode." → "The pre-stated table (CONTRIBUTING, 'The default mode of 0.1.0') fired its first row: <pct> % agreement, no `safe` command denied, so 0.1.0 ships `mode: enforce` with `allowMode: passthrough`."
- CHANGELOG `### Changed`, **first bullet**: "- **`mode` defaults to `enforce`.** `ask` and `deny` are live; a confident `allow` still passes through (`allowMode: passthrough`). Decided by the table in CONTRIBUTING from the HG-4 run: <pct> % agreement, no `safe` command denied. If you relied on the audit default, set `"mode": "audit"` in `~/.hookgate.json` (HG-4, HG-5, D4)."

**Row (ii):** code and tests untouched.
- `README.md:51` → "The default in `0.1.0` (HG-4 measured <pct> %, see Benchmark); `0.2.0` retries with thresholds tuned from the audit log."
- `README.md:196-197` → "The pre-stated table (CONTRIBUTING, 'The default mode of 0.1.0') fired its second row: <pct> % agreement and <safeDeny> `safe` command(s) denied, so 0.1.0 keeps `mode: audit`; `0.2.0` retries with thresholds tuned from `hookgate report`."
- CHANGELOG `### Changed`: "- `mode` stays `audit` by default: HG-4 measured <pct> % agreement and <safeDeny> `safe` → `deny`, under the pre-stated bar; `0.2.0` retries (HG-4, D4)."

### Tests

| Case | Input | Expected |
|---|---|---|
| default mode (row i) | `loadConfig(d, { HOOKGATE_USER_CONFIG: join(d, 'none.json') }).cfg.mode` | `'enforce'` |
| allow never default (row i) | `DEFAULTS.allowMode` | `'passthrough'` |
| row (ii) | — | no test change; `npm test` green as before |

### Verify

```bash
npm test
node -e "import('./bin/lib/config.mjs').then(m=>console.log(m.DEFAULTS.mode, m.DEFAULTS.allowMode))"   # "enforce passthrough" (i) or "audit passthrough" (ii)
grep -n 'under about 90\|default until' README.md     # nothing
```

### Acceptance criteria

- [ ] Exactly one row applied; README 51 and 196-197 name the row and the number; CHANGELOG leads with the default (row i)

---

## S11 · D1 — release 0.1.0 · **Human** (tag) · *blocked on S9, S10, S8 pass*

**Touches:** `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json` (version only) · `CHANGELOG.md` · `BACKLOG.md` · `ROADMAP.md` (regenerated — the seventh file; Structure said six, but CI fails without it, `CLAUDE.md` rule 8). No tests: `check`'s version invariant is the test.

### Changes

```bash
git checkout main && git pull && git checkout -b release-0.1.0
sed -i '' 's/"version": "0.0.3"/"version": "0.1.0"/' package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json
grep -n '"version"' package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json   # four × 0.1.0
```
`CHANGELOG.md:6` `## [Unreleased]` → `## [0.1.0] — <YYYY-MM-DD>`; insert `## [Unreleased]` plus
one blank line above it (`check` needs the heading, `bin/hookgate.mjs:104`). Confirm the section
carries S1 (D2, with the "move it to `~/.hookgate.json`" note), S2, S3, S4, S9 and S10:
`grep -c 'failClosed\|Harness detection\|Audit mode never\|hookgate doctor. names\|HG-4 benchmark run\|mode. defaults to\|mode. stays' CHANGELOG.md` ≥ 6.

`BACKLOG.md`: `sed -i '' 's/ver=main/ver=0.1.0/g' BACKLOG.md`; tick `HG-1` (`:53` — done-when met:
`00`–`04` written, this plan passed its zero-context test) and `HG-5` (`:75` — ships with this
tag), each metadata comment gaining ` ver=0.1.0`; `node scripts/backlog.mjs roadmap`.

```bash
npm test && npm run backlog && npm pack --dry-run
git diff --stat main                                          # exactly 7 files: four manifests, CHANGELOG.md, BACKLOG.md, ROADMAP.md
git diff main -- package.json | grep '^[-+] ' | grep -vc version   # 0 — only the version moved, so the tarball's file list is 0.0.3's
```
Open the PR, merge on green, then **within two hours** (release-drift, CONTRIBUTING.md:102-103):
```bash
git checkout main && git pull && git tag hookgate--v0.1.0 && git push origin hookgate--v0.1.0
gh run watch $(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')
npm view hookgate version                                     # 0.1.0
gh release view hookgate--v0.1.0                              # exists; milestone "v0.1.0 — Two gates, one benchmark" (BACKLOG.md:39) closed
```
**FAIL:** red release run → `gh workflow run Release -f tag=hookgate--v0.1.0` (idempotent, CONTRIBUTING.md:147); a stray file in `git diff --stat` → revert it, never ship it.

### Acceptance criteria

- [ ] Seven files in the release PR, nothing else; `npm test`, `npm run backlog` green; tag pushed; release workflow green; `npm view hookgate version` prints `0.1.0`

---

## Rollback

- S1–S4, S10: single-PR code changes, no data migration — `git revert <merge sha>`; a user hit by D2 sets `failClosed` in `~/.hookgate.json` meanwhile.
- S5–S9: text and committed data — revert the PR.
- S11: a published version cannot be reused — `npm deprecate hookgate@0.1.0 "<reason>"` and release 0.1.1 from a revert (CONTRIBUTING.md:118-123).

---

## Zero-context test — run against this plan, 2026-09-23

| Step | What an executor would still have to guess | Result |
|---|---|---|
| S1 | nothing — fixture pattern, the test to rewrite, the exact line and the ignored-message text are cited | pass |
| S2 | nothing — the CLI event JSON is given | pass |
| S3 | nothing — order, signal names, new export's shape, nine rows; the plan addition (rung 5) is flagged for the human | pass |
| S4 | nothing — line texts and regexes given | pass |
| S5 | nothing — table and runbook written out; the port 4747 is a stated convention | pass |
| S6 | nothing — twelve edits with old and new text | pass |
| S7 | the README prose around the table (`:147-152`) is described, not dictated — acceptable for a human step | pass |
| S8 | nothing beyond S5's text; the failure path is named | pass |
| S9 | nothing — the five ask-share percentages are copied verbatim from the runner | pass |
| S10 | nothing — one command picks the row; both rows' texts are given | pass |
| S11 | nothing — milestone title from `BACKLOG.md:39` | pass |

---

## Status

- [x] Every step has exact paths
- [x] Every new function has a complete signature
- [x] Every test case has inputs and expected outputs
- [x] Every verification command is copy-pasteable
- [x] **Zero-context test:** an agent reading only this file can execute it
- [x] Rollback plan present

> Next phase: **Implement**. It receives: this file + `99-progress.md`.
> One session per step.
