# Changelog

All notable changes to hookgate. The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/). Items reference their `HG-n` backlog id.

## [Unreleased]

### Added
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

### Changed
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
