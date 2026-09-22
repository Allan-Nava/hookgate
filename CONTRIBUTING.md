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

Lives in `evals/` once the gates exist. The rules it has to obey are already fixed:
hand-labelled commands, the same set against a `type: prompt` hook on
`claude-opus-5`, agreement, p50/p95 latency, cost per decision, `ask` share per
threshold, the Jev version the response reported, the date. Re-run on every Jev
version change: `jev-latest` may answer differently without a code change.

## Pull requests

- Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`), imperative subject.
- Keep `npm test` green; add a check when you add an invariant.
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

The publisher matches on the literal filename, so never rename `release.yml`. Never
give `actions/setup-node` a `registry-url`: it plants a placeholder token that stops
the OIDC exchange with a misleading 404.

**Per release:**

```bash
# 1. bump the version in all three manifests — they must agree
#    package.json · .claude-plugin/plugin.json · .claude-plugin/marketplace.json
npm test
npm pack --dry-run

# 2. land the bump on main through a pull request, then
claude plugin tag . --dry-run
claude plugin tag . --push     # creates and pushes hookgate--v{version}
```

The tag triggers `release.yml`: it re-checks the tag against `package.json`, runs the
tests, publishes, waits up to five minutes for the registry, cuts the GitHub release
and closes the milestone whose title starts with `v{version}`. A failed run is
re-run with `gh workflow run Release -f tag=hookgate--v{version}`; every step is
idempotent.
