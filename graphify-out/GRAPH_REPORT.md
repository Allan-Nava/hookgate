# Graph Report - hookgate  (2026-09-22)

## Corpus Check
- 31 files · ~44,824 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 453 nodes · 896 edges · 20 communities (18 shown, 2 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 83 edges (avg confidence: 0.86)
- Token cost: 134,779 input · 0 output

## Community Hubs (Navigation)
- Gate design and contracts
- Config, store and Jev client
- Release, benchmark and backlog rules
- Manifests and packaging
- Scorecard and v0.1.2 bugs
- Gates, questions and eval runner
- Backlog script
- Site generator
- CLI entry and report
- Scorecard runner
- Redaction and local benchmark
- Test suites
- HG-1 QRSPI artifacts
- Social preview card
- Logo mark
- Monochrome logo
- Renovate config
- Backlog CI sync
- CI pack job
- CodeQL analysis

## God Nodes (most connected - your core abstractions)
1. `CLAUDE.md (hookgate guidance)` - 18 edges
2. `loadConfig()` - 17 edges
3. `hookgate` - 17 edges
4. `Release 0.0.3 — 2026-09-22` - 17 edges
5. `preToolUse()` - 16 edges
6. `HG-1 design notes, as implemented` - 14 edges
7. `00 · Questions — HG-1` - 13 edges
8. `stop()` - 13 edges
9. `Scorecard (evals/scorecard.mjs)` - 13 edges
10. `BACKLOG.md — single source of truth` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Stop guard is double` --references--> `preToolUse()`  [AMBIGUOUS]
  thoughts/HG-1-jev-gates/design-notes.md → bin/lib/handlers.mjs
- `CLAUDE.md (hookgate guidance)` --references--> `loadConfig()`  [INFERRED]
  CLAUDE.md → bin/lib/config.mjs
- `Every config value is checked` --implements--> `loadConfig()`  [INFERRED]
  README.md → bin/lib/config.mjs
- `Configuration trust order` --implements--> `loadConfig()`  [INFERRED]
  README.md → bin/lib/config.mjs
- `HG-29 — Validate the numbers in the config and classify a non-JSON body` --references--> `RULES`  [EXTRACTED]
  BACKLOG.md → bin/lib/config.mjs

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The never-widen principle across gates, promotion and config** — readme_never_widens, thoughts_hg_1_jev_gates_design_notes_passthrough_on_allow, readme_below_threshold_is_ask, readme_tighten_only_repository_config, backlog_hg_24, backlog_hg_25, backlog_hg_26 [INFERRED 0.85]
- **Release pipeline over npm Trusted Publishing** — _github_workflows_release_tag_hookgate_v, _github_workflows_release_resolve_and_verify_the_version, _github_workflows_release_use_an_npm_that_speaks_oidc, _github_workflows_release_publish_to_npm, _github_workflows_release_verify_the_published_version, _github_workflows_release_create_the_github_release, _github_workflows_release_close_the_milestone, _github_workflows_release_npm_trusted_publishing, contributing_trusted_publisher_setup, contributing_release_runbook, backlog_hg_31 [EXTRACTED 1.00]
- **Bugs from the first measurements, each scored by the scorecard** — backlog_hg_23, backlog_hg_24, backlog_hg_25, backlog_hg_26, backlog_hg_27, backlog_hg_28, backlog_hg_29, backlog_hg_30, readme_scorecard, contributing_evals_fixtures, _github_workflows_scorecard_scorecard_workflow, readme_local_measurements [EXTRACTED 1.00]
- **QRSPI artifact chain for HG-1 (brief → questions → research → design → structure → plan → progress)** — thoughts_hg_1_jev_gates_00_brief_hg_1_brief, thoughts_hg_1_jev_gates_00_questions_questions_phase, thoughts_hg_1_jev_gates_01_research_research_phase, thoughts_hg_1_jev_gates_02_design_design_phase, thoughts_hg_1_jev_gates_03_structure_structure_phase, thoughts_hg_1_jev_gates_04_plan_plan_phase, thoughts_hg_1_jev_gates_99_progress_progress_state [EXTRACTED 1.00]
- **assets_social_preview_gate_pipeline** — assets_social_preview_pretooluse_gate, assets_social_preview_stop_gate, assets_social_preview_jev_confidence_score, assets_social_preview_decision_policy [EXTRACTED 1.00]

## Communities (20 total, 2 thin omitted)

### Community 0 - "Gate design and contracts"
Cohesion: 0.06
Nodes (64): CI check matrix (Node 18/20/22/24, no npm install), CI fall-through test per harness, Pages build and deploy, Release drift check, Social preview OG card (1280x640), HG-1 — Run QRSPI on the brief, HG-10 — Audit mode: log every decision without enforcing, HG-11 — Codex CLI adapter: same handlers, Codex answer shape (+56 more)

### Community 1 - "Config, store and Jev client"
Cohesion: 0.09
Nodes (43): get(), loadConfig(), merge(), readJson(), RULES, TIGHTEN, userConfigPath(), validate() (+35 more)

### Community 2 - "Release, benchmark and backlog rules"
Cohesion: 0.07
Nodes (49): Close the milestone, Create the GitHub release, Do not rename release.yml, --ignore-scripts on install, No registry-url on setup-node, npm Trusted Publishing (OIDC), Publish to npm, release job (+41 more)

### Community 3 - "Manifests and packaging"
Cohesion: 0.05
Nodes (41): marked, author, bin, hookgate, bugs, url, description, devDependencies (+33 more)

### Community 4 - "Scorecard and v0.1.2 bugs"
Cohesion: 0.11
Nodes (37): Check out the base, Fixtures always from the head, Hook overhead on this runner, Job summary, Regression on any metric fails, Score the base with the head's fixtures, Score the head, scorecard job (+29 more)

### Community 5 - "Gates, questions and eval runner"
Cohesion: 0.12
Nodes (28): DEFAULTS, COMMAND_QUESTIONS, commandState(), COMPLETION_LEXICONS, COMPLETION_QUESTION, completionState(), decideCommand(), decideCompletion() (+20 more)

### Community 6 - "Backlog script"
Cohesion: 0.14
Nodes (23): apply(), ensureLabels(), ensureMilestone(), existingIssues(), issueBody(), LABELS, lint(), main() (+15 more)

### Community 7 - "Site generator"
Cohesion: 0.10
Nodes (20): body, description, dropEmptyHead(), esc(), jsonLd, lastmod, { lede, after }, linkifyPaths() (+12 more)

### Community 8 - "CLI entry and report"
Cohesion: 0.16
Nodes (18): check(), checkHooksFile(), [cmd = 'help'], handler(), HANDLERS, help(), HOOK_EVENTS, json() (+10 more)

### Community 9 - "Scorecard runner"
Cohesion: 0.14
Nodes (17): add(), ALLOW, argv, DENY, env(), fetchWith(), HERE, load() (+9 more)

### Community 10 - "Redaction and local benchmark"
Cohesion: 0.18
Nodes (13): PATTERNS, prepare(), redact(), truncate(), argv, BIN, HERE, lines (+5 more)

### Community 11 - "Test suites"
Cohesion: 0.18
Nodes (13): answers, baseEnv(), BIN, exec(), requests, run(), allow, ask (+5 more)

### Community 12 - "HG-1 QRSPI artifacts"
Cohesion: 0.18
Nodes (16): Out of scope for HG-1, Q10 · How much Codex must exist in 0.1.0, Q1 · Does 0.1.0 emit allow at all, Q2 · May a repo config loosen the gate, Q3 · Who labels the benchmark commands and by what rule, Q4 · Is shipping every Bash command to a third-party API acceptable and what is redacted, Q5 · How many times may the Stop gate block per turn, Q6 · What does git state mean for the Stop gate (+8 more)

### Community 13 - "Social preview card"
Cohesion: 0.36
Nodes (8): hookgate social preview card, Confident: act. Unsure: ask. Unreachable: get out of the way., Calibrated, sub-second decisions inside Claude Code's hooks, TypeSafe's Jev answers with a confidence score, hookgate logo mark (blue rounded tile, gate glyph), PreToolUse gate on shell commands, github.com/Allan-Nava/hookgate · MIT, Stop gate on unverified completion

### Community 14 - "Logo mark"
Cohesion: 0.38
Nodes (7): hookgate logo (assets/logo.svg), Rounded square tile, steel blue #2f5d8a, 64x64 grid, 14px corner radius, Inner crossbar: short horizontal rail between the posts, white at 85% opacity, Gate frame: top lintel bar plus two vertical posts (open-bottomed arch), solid white, Gate mark: white gate/portal frame with crossbar and latch dot on a blue rounded tile, Latch dot: centred circle below the crossbar, white at 85% opacity, Visual metaphor: a gate that webhooks pass through, the bar and dot as the check/latch at the threshold

### Community 15 - "Monochrome logo"
Cohesion: 0.53
Nodes (6): Monochrome currentColor variant: no tile, inherits text colour, 64x64 grid, Gate frame: lintel and two posts, Gate metaphor: a webhook gate that admits or holds incoming events, Latch bar: short crossbar inside the gate (85% opacity), Dot below the latch: the event or payload held at the gate (85% opacity), hookgate monochrome logo (logo-mono.svg)

### Community 16 - "Renovate config"
Cohesion: 0.40
Nodes (4): config:recommended, helpers:pinGitHubActionDigests, extends, $schema

### Community 17 - "Backlog CI sync"
Cohesion: 0.67
Nodes (3): Backlog issue sync (one-way), CI backlog job (lint, check, planner test), Backlog planner fixture (v9.9.0)

## Ambiguous Edges - Review These
- `Stop gate on unverified completion` → `hookgate logo mark (blue rounded tile, gate glyph)`  [AMBIGUOUS]
  assets/social-preview.png · relation: semantically_similar_to
- `preToolUse()` → `Stop guard is double`  [AMBIGUOUS]
  thoughts/HG-1-jev-gates/design-notes.md · relation: references

## Knowledge Gaps
- **114 isolated node(s):** `PATTERNS`, `$schema`, `config:recommended`, `helpers:pinGitHubActionDigests`, `LABELS` (+109 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Stop gate on unverified completion` and `hookgate logo mark (blue rounded tile, gate glyph)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `preToolUse()` and `Stop guard is double`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `loadConfig()` connect `Config, store and Jev client` to `Gate design and contracts`, `Scorecard and v0.1.2 bugs`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `CLAUDE.md (hookgate guidance)` connect `Gate design and contracts` to `Config, store and Jev client`, `Release, benchmark and backlog rules`, `Scorecard and v0.1.2 bugs`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `systemone()` connect `Config, store and Jev client` to `Gate design and contracts`, `Scorecard and v0.1.2 bugs`, `Gates, questions and eval runner`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `loadConfig()` (e.g. with `CLAUDE.md (hookgate guidance)` and `Every config value is checked`) actually correct?**
  _`loadConfig()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PATTERNS`, `$schema`, `config:recommended` to the rest of the system?**
  _114 weakly-connected nodes found - possible documentation gaps or missing edges._