# Contributing

## Local loop

```bash
npm test                          # == node bin/hookgate.mjs check
echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | node bin/hookgate.mjs pre-tool-use
```

The check validates the three manifests and their versions, `hooks/hooks.json`
(events, commands, timeouts), the fail-open statement in the README and the files the
tarball ships. Extend it whenever you add an invariant; CI runs it on Node 18, 20, 22
and 24 without `npm install`, plus `npm pack --dry-run` on 24.

To try the plugin against a real Claude Code: `/plugin marketplace add .` then
`/plugin install hookgate@hookgate` in a scratch repo, with `TYPESAFE_API_KEY` set.
Unset the key and every gate must fall through.

## Benchmark protocol

`evals/commands.jsonl` holds 79 shell commands labelled by hand — 35 `safe`, 26 `ask`,
18 `dangerous` — and `evals/injection.jsonl` 20 tool outputs, 10 clean and 10 carrying
instructions addressed to an agent. `evals/run.mjs` runs them:

```bash
node evals/scorecard.mjs                                      # no key: one metric per open bug, from evals/fixtures/
node evals/local.mjs --json                                   # no key: hook overhead + transcript counts
node evals/run.mjs commands --baseline-only --limit 10        # no key: the incumbent alone
TYPESAFE_API_KEY=… node evals/run.mjs commands --limit 5      # smoke run, five commands
TYPESAFE_API_KEY=… node evals/run.mjs commands --baseline     # the whole set, plus the incumbent
TYPESAFE_API_KEY=… node evals/run.mjs injection
```

`evals/scorecard.mjs` is how a bug fix proves itself. Each open bug in `BACKLOG.md`
has a metric — a share in [0, 1], 1 meaning fixed — computed from the labelled
fixtures under `evals/fixtures/` with no key and no network: the prefilter's recall per
language, what the promotion logic would propose for compound and interpreter
commands, whether a `rm -rf` hidden in an over-long command reaches the judge, whether
a repository config can loosen the gate, and so on. `.github/workflows/scorecard.yml`
runs it on the base and on the head of every pull request with the head's fixtures,
posts the two columns and the delta as one sticky comment, and fails on a regression.
A fix should move its metric to 100% and leave the others where they were; a new bug
gets a fixture and a metric in the same pull request that files it, so the fix has a
number to reach. `--root <checkout>` scores another checkout with these fixtures, and a
checkout that predates a metric scores n/a rather than failing.

`evals/local.mjs` reads Claude Code's own transcripts under `~/.claude/projects` and
keeps only counts — how many stops the prefilter skips, how often a command repeats
within a session, what the redactor would touch, which prefixes dominate. Nothing it
reads leaves the machine and nothing but aggregates is written.

`--baseline` adds what a `type: prompt` hook does today: one `claude -p` call on
`claude-opus-5` judging the same command, timed and costed from the CLI's own usage
report. It needs a logged-in `claude`. The runner refuses to start without a key,
because every run costs money, and writes `evals/results/<date>-<set>-<jev version>.json`
plus the README table. Commit the JSON with the table: the table is one run, one
version, one date, and says so. Re-run when the Jev version the responses report
changes — `jev-latest` may answer differently without a code change — and when a
threshold default moves.

The rule the README states in advance: under about 90% agreement with the labels,
the command gate ships `ask`-only; the injection screen stays off until its
false-positive count on the clean set is zero.

## Backlog, roadmap, issues

`BACKLOG.md` is the single source of truth: every planned item has a stable `HG-n`
id and a trailing `<!-- hg: prio=… size=… labels=… -->`; a shipped item is ticked and
says where it went (`ver=0.1.0`, or `ver=main` until released). `ROADMAP.md` is
generated from it:

```bash
node scripts/backlog.mjs lint       # ids unique, metadata complete, milestones well-formed
node scripts/backlog.mjs roadmap    # regenerate ROADMAP.md — commit it with the backlog change
node scripts/backlog.mjs check      # what CI runs: fails when ROADMAP.md is stale
node scripts/backlog.mjs issues     # the plan for the GitHub issues; --apply executes it
```

The issues are the third view. `.github/workflows/backlog-issues.yml` runs the sync
on every push to `main` that changes `BACKLOG.md`: it opens an issue for a new open
item (title `HG-n — Title`, labels from the metadata plus `prio-*`, the milestone
named by the heading), retitles one whose name changed, closes one whose item was
ticked, reopens one whose item was un-ticked, and never creates an issue for an item
that shipped without one. It runs one way only; closing an issue on GitHub changes
nothing. Run it by hand with `workflow_dispatch` and `dry_run` to see the plan.

The planner is tested against `scripts/fixtures/` without a network call, because
its failure modes are all decisions: a duplicate opened on every push, an issue closed
for work still open.

## Pull requests

- Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`), imperative subject.
- Keep `npm test` and `npm run backlog` green; add a check when you add an invariant.
- Reference the `HG-n` id in the subject when the change belongs to a backlog item, and
  add a line under `## [Unreleased]` in CHANGELOG.md — `check` fails without that section.
- `main` is meant to be protected the way qrspi's is: pull request, green CI, no
  direct pushes. Set the ruleset once the repo is public.

## Releasing

Releases run from GitHub Actions. Pushing the tag is the only manual step, and
`release-drift.yml` fails when `main` carries a version with no tag for two hours.

**One-time setup — npm Trusted Publishing.** There is no npm token in this
repository: the release job authenticates over OIDC. npm cannot configure a trusted
publisher for a package that does not exist, so **the first version is published by
hand** (`npm publish --access public` from a checkout), then on npmjs.com → package →
Settings → Trusted Publisher → GitHub Actions:

| Field | Value |
|---|---|
| Organization or user | `Allan-Nava` — this case, exactly |
| Repository | `hookgate` |
| Workflow filename | `release.yml` |
| Environment | *(leave empty)* |

**The name had a past.** `hookgate` on npm carried a `0.0.1` published and unpublished
from this same account on 2026-03-23 — the name was already ours. npm never lets a version number be reused, even a
withdrawn one, so our first publishable version is `0.0.2`. `npm view <name>` reports
an *error* for a name with no live versions, which reads as "free" — check
`https://registry.npmjs.org/<name>` and its `time.unpublished` instead before trusting
a name.

The publisher matches on the literal filename, so never rename `release.yml`. Never
give `actions/setup-node` a `registry-url`: it plants a placeholder token that stops
the OIDC exchange with a misleading 404.

**Per release:**

```bash
# 1. bump the version in all four manifests — they must agree
#    package.json · .claude-plugin/plugin.json · .claude-plugin/marketplace.json · .codex-plugin/plugin.json
#    rename CHANGELOG's [Unreleased] to [x.y.z] — date, and open a new empty [Unreleased]
#    turn every ver=main in BACKLOG.md into ver=x.y.z and regenerate the roadmap
npm test
npm pack --dry-run

# 2. land the bump on main through a pull request, then tag that merge commit
git checkout main && git pull
git tag hookgate--v{version} && git push origin hookgate--v{version}
```

The tag triggers `release.yml`: it re-checks the tag against `package.json`, runs the
tests, publishes, waits up to five minutes for the registry, cuts the GitHub release
and closes the milestone whose title starts with `v{version}`. A failed run is
re-run with `gh workflow run Release -f tag=hookgate--v{version}`; every step is
idempotent.
