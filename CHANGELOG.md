# Changelog

All notable changes to hookgate. The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/). Items reference their `HG-n` backlog id.

## [Unreleased]

### Fixed
- The audit log dropped the token usage Jev reported, so cost per decision could not
  be computed. Every judged decision logs `inputTokens` (0 on a cache hit), and
  `hookgate report` prints tokens, total cost and cost per judged decision at the
  published input price, one dated constant shared with `evals/run.mjs` (HG-28).
- A repository's own `.hookgate.json` could switch the gates off, go audit, or set a
  model or timeout that fails open. Configuration now has a trust order — defaults,
  `~/.hookgate.json`, `HOOKGATE_CONFIG`, then the repository file, then the environment
  — and the repository file may only tighten; what it tried and could not do is listed
  by `hookgate doctor` (HG-27).
- Rule promotion counted a chained command's verdict against its first word and could
  propose a prefix rule for an interpreter or wrapper. Only one simple command — no
  chaining, no pipe, no substitution outside quotes — counts, and a never-promote set
  (`python3`, `bash`, `sudo`, `xargs`, `find`…) excludes programs that run whatever
  follows; the log carries `promotable` beside the descriptive `prefix` (HG-24, HG-25).
- A command longer than `maxStateChars` reached Jev with its middle elided, so anything
  hidden there was never judged. The command gate now answers `ask` for such a command
  without a request; audit mode logs `skipped: too-long` and falls through (HG-26).
- The completion prefilter read English only, so a final message in another language
  never reached Jev: 766 of 1,229 real stops were Italian claims it skipped. The lexicon
  is now per language (English, Italian), always on, with ambiguous words anchored to
  their claim form, and `completion.lexicon` adds patterns from the config. The measured
  skip rate is 29%, not the 81% first reported (HG-23).

### Added
- `evals/scorecard.mjs` and `evals/fixtures/`: one metric per open bug, from labelled
  fixtures, no key; `scorecard.yml` scores base and head of every pull request and
  posts the delta, failing on a regression (HG-30).
- The command gate (HG-2), the completion gate (HG-3) and the off-by-default
  injection screen (HG-15, code only), decided by Jev with calibrated confidence.
- Audit mode and `hookgate report` (HG-10); per-session decision cache (HG-12); rule
  promotion in the harness's own syntax (HG-13); `hookgate doctor` (HG-14);
  `failClosed` opt-in (HG-9); Codex CLI adapter aligned to the documented hook contract
  — `permissionDecision` shape, `ask` as pass-through plus `systemMessage` or
  `codex.askAs: deny`, injection feedback via `decision: block` — with e2e tests under
  `PLUGIN_ROOT`; harness also detected from the stdin shape and `HOOKGATE_HARNESS`;
  `codex/hooks.json` in Codex's single-command form; config also read from
  `.hookgate.json` and `.codex/hookgate.json`; verified live on Codex 0.155.1, which has
  dropped plugin-bundled hooks — `hookgate print-hooks` writes the repo-level
  `.codex/hooks.json` with absolute paths (HG-11).
- `evals/`: 79 hand-labelled commands, 20 tool outputs, and the benchmark runner with
  a `type: prompt` baseline (HG-4, tooling only — the run is blocked on a key).
- The repository as a knowledge graph under `graphify-out/`, versioned and queryable
  (HG-22).
- README section "What leaves the machine, exactly" (HG-17); `HOOKGATE_ENDPOINT` for
  proxies and end-to-end tests (HG-19); this changelog (HG-20); CodeQL and Renovate
  digest pinning for actions (HG-21).

### Added (measured, no key)
- `evals/local.mjs`: hook overhead and transcript-derived counts; `--baseline-only` on
  the runner; the README Benchmark section carries the incumbent's ten-command numbers,
  the plugin's own cost, and what 102 real sessions say (HG-16, half).

### Changed
- Command-prefix logic skips `cd … &&`, `cd …;`, newline-separated `cd` hops and
  `VAR=value` assignments before naming a prefix; `cd` no longer dominates promotion.
- The completion gate asks Jev only when the final message claims completion; a local
  prefilter skips questions and partial reports, logged as `skipped` so `report` shows
  the share that never reached the network (brief Q7).
- Audit log rotates at 8 MB; session files are written atomically and pruned after
  seven days (HG-18).

### Fixed
- A malformed `TYPESAFE_API_KEY` is reported as such instead of an opaque fetch error.
- The rule-promotion message under Codex used Claude Code's answer shape.
- The benchmark runner passed an undefined `CLAUDECODE` to the child `claude`.
- Three CodeQL findings from the first scan: an unanchored regex in `check`, a
  one-pass HTML-comment strip in the backlog tool that could leave a `<!--`, and a
  check-then-use on the audit log file.

## [0.0.2] — 2026-09-22

### Added
- The scaffold: manifests, `hooks.json` with two inert handlers, `check`, CI on Node
  18/20/22/24, release by tag over npm trusted publishing, Pages site generated from
  the README, `BACKLOG.md` as the single source of truth with the one-way issue sync.
  `0.0.1` is burnt on npm by a version published and unpublished in March.
