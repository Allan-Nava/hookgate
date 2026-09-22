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

- [ ] **HG-9 — Short name**: what it is, why it earns its place, what it needs to
  touch. <!-- hg: prio=high size=M labels=gate -->
```

- The **id never changes**. A new item takes the next free number, never a retired
  one. Moving an item to another milestone is fine; renumbering it is not.
- `- [ ]` is open, `- [x]` is shipped, and a shipped item says where it went:
  `ver=0.1.0`, or `ver=main` when it is merged but not yet released.
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

- [ ] **HG-1 — Run QRSPI on the brief: Questions → Research → Spec → Plan**: the
  design work for the first release, one fresh session per phase, input
  `thoughts/HG-1-jev-gates/00-brief.md`. Done when `00` to `04` are ticked and the
  plan passes the zero-context test; its steps become the pull requests for HG-2,
  HG-3 and HG-4. Rule 4: the brief does not enter Research.
  <!-- hg: prio=high size=L labels=gate,enhancement -->
- [ ] **HG-2 — Command-risk gate: PreToolUse on Bash answered by Jev**: one
  `Choice{allow, ask, deny}` and one `Noul` on a redacted, truncated state; below
  the confidence threshold the decision is `ask`, never `allow`; thresholds in
  `.claude/hookgate.json`; a unit test per fail-open path, runnable without a key.
  <!-- hg: prio=high size=L labels=gate -->
- [ ] **HG-3 — Completion gate: Stop hook that blocks unverified claims of done**:
  one `Noul` on `last_assistant_message` plus a capped `git status`; `block` with a
  reason that names what to verify; at most one block per stop so the agent cannot
  loop. <!-- hg: prio=high size=M labels=gate -->
- [ ] **HG-4 — Benchmark: ≥50 labelled commands, Jev gate vs type: prompt hook**:
  `evals/commands.jsonl` labelled by hand, `evals/run.mjs` dependency-free,
  agreement, p50/p95 latency, cost per decision, `ask` share per threshold; one
  dated run with the Jev version the responses reported. Under ~90% agreement the
  command gate ships `ask`-only. <!-- hg: prio=high size=M labels=benchmark -->
- [ ] **HG-5 — First release 0.1.0: bootstrap npm trusted publishing, tag, publish**:
  `0.1.0` published by hand because npm cannot configure a trusted publisher for a
  package that does not exist, then the publisher, then the tag so `release.yml`
  cuts the release and closes the milestone. <!-- hg: prio=med size=S labels=release -->
- [x] **HG-6 — Site generated from README, as qrspi does it**: `site/build.mjs`
  ported with the gates index read off `hooks/hooks.json`, logo, social preview,
  Pages workflow. <!-- hg: prio=low size=S labels=docs ver=main -->
- [x] **HG-7 — Backlog as the single source of truth, enforced by CI**: this file,
  `scripts/backlog.mjs` (lint, roadmap, check, issues), the generated ROADMAP.md,
  the one-way issue sync on push to `main`, and the `backlog` CI job.
  <!-- hg: prio=med size=M labels=project ver=main -->

## v0.2.0 — After the first run <!-- ms: phase=later -->

What the brief left out on purpose, to be taken up once the benchmark says how the
gates behave in the wild.

- [ ] **HG-8 — PostToolUse output hygiene**: a hook cannot truncate a tool result,
  only add context or block; find out whether a `Noul` "is this output worth keeping
  in context?" that answers with `additionalContext` earns its call. Needs a
  measurement first. <!-- hg: prio=low size=M labels=gate,benchmark -->
- [ ] **HG-9 — Fail-closed as an explicit opt-in**: `.claude/hookgate.json` gains
  `failClosed: true`, under which an unreachable API means `ask` rather than
  fall-through; never the default. <!-- hg: prio=low size=S labels=gate -->
