# Graph Report - hookgate  (2026-09-22)

## Corpus Check
- Corpus is ~34,112 words - fits in a single context window. You may not need a graph.

## Summary
- 367 nodes · 757 edges · 14 communities
- Extraction: 87% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.87)
- Token cost: 196,860 input · 0 output

## Community Hubs (Navigation)
- Backlog Items & Project Docs
- Gate Library & Decisions
- Package Manifest
- Repo Rules & CI Docs
- Backlog Tooling
- Site Generator
- Release & Sync Workflows
- CLI Entry & Report
- Test Suite
- Social Preview Card
- Logo Mark
- Monochrome Logo
- Redaction
- Renovate Config

## God Nodes (most connected - your core abstractions)
1. `hookgate — Claude Code (and Codex) plugin` - 21 edges
2. `hookgate — calibrated, sub-second decisions inside Claude Code hooks` - 19 edges
3. `Changelog [Unreleased]` - 18 edges
4. `preToolUse()` - 17 edges
5. `stop()` - 14 edges
6. `HG-1 brief — Jev in Claude Code gates` - 14 edges
7. `00 · Questions — HG-1` - 14 edges
8. `postToolUse()` - 13 edges
9. `HG-1 design notes, as implemented` - 13 edges
10. `Command risk gate (PreToolUse on Bash)` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Decision: gates in the harness, not a library for apps` --semantically_similar_to--> `Why in the hooks`  [INFERRED] [semantically similar]
  thoughts/HG-1-jev-gates/00-brief.md → README.md
- `Rule 1: Fail-open` --semantically_similar_to--> `Fail-open, always`  [INFERRED] [semantically similar]
  CLAUDE.md → README.md
- `Rule 3: State never carries secrets` --semantically_similar_to--> `Secret redaction before send`  [INFERRED] [semantically similar]
  CLAUDE.md → README.md
- `Audit mode is a mode, not a flag per gate` --semantically_similar_to--> `The benchmark gates the milestone`  [INFERRED] [semantically similar]
  thoughts/HG-1-jev-gates/design-notes.md → BACKLOG.md
- `Constraints: state <= 32k tokens, 2 s latency budget` --semantically_similar_to--> `Rule 3: State never carries secrets`  [INFERRED] [semantically similar]
  thoughts/HG-1-jev-gates/00-brief.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **QRSPI artifact chain for HG-1 (brief → questions → research → design → structure → plan → progress)** — thoughts_hg_1_jev_gates_00_brief_hg_1_brief, thoughts_hg_1_jev_gates_00_questions_questions_phase, thoughts_hg_1_jev_gates_01_research_research_phase, thoughts_hg_1_jev_gates_02_design_design_phase, thoughts_hg_1_jev_gates_03_structure_structure_phase, thoughts_hg_1_jev_gates_04_plan_plan_phase, thoughts_hg_1_jev_gates_99_progress_progress_state [EXTRACTED 1.00]
- **Release by tag: runbook, OIDC publish, milestone close, drift check, HG-5** — contributing_release_runbook, _github_workflows_release_release_pipeline, _github_workflows_release_npm_trusted_publishing, _github_workflows_release_milestone_close, _github_workflows_release_drift_release_drift_check, backlog_hg_5, contributing_trusted_publisher_setup [INFERRED 0.95]
- **Backlog as single source of truth with its generated views (roadmap, issues, CI, fixture)** — backlog_backlog_single_source_of_truth, roadmap_generated_roadmap, _github_workflows_backlog_issues_backlog_issue_sync, _github_workflows_ci_backlog_job, claude_scripts_backlog, scripts_fixtures_backlog_planner_fixture, backlog_hg_7 [INFERRED 0.95]
- **assets_social_preview_gate_pipeline** — assets_social_preview_pretooluse_gate, assets_social_preview_stop_gate, assets_social_preview_jev_confidence_score, assets_social_preview_decision_policy [EXTRACTED 1.00]

## Communities (14 total, 0 thin omitted)

### Community 0 - "Backlog Items & Project Docs"
Cohesion: 0.05
Nodes (88): CI fall-through test per harness, CodeQL analysis (security-extended, weekly), The benchmark gates the milestone, HG-1 — Run QRSPI on the brief, HG-10 — Audit mode: log every decision without enforcing, HG-11 — Codex CLI adapter: same handlers, Codex answer shape, second manifest, HG-12 — Per-session decision cache, HG-13 — Promote confident, repeated decisions into harness rules (+80 more)

### Community 1 - "Gate Library & Decisions"
Cohesion: 0.07
Nodes (61): DEFAULTS, loadConfig(), merge(), doctor(), COMMAND_QUESTIONS, commandState(), COMPLETION_QUESTION, completionState() (+53 more)

### Community 2 - "Package Manifest"
Cohesion: 0.05
Nodes (41): marked, author, bin, hookgate, bugs, url, description, devDependencies (+33 more)

### Community 3 - "Repo Rules & CI Docs"
Cohesion: 0.13
Nodes (25): CI check matrix (Node 18/20/22/24, no npm install), CI pack job (npm pack --dry-run), Pages build and deploy, Social preview OG card (1280x640), HG-6 — Site generated from README, as qrspi does it, bin/hookgate.mjs CLI (check, pre-tool-use, stop, post-tool-use, doctor, report), bin/lib modules (config, redact, jev, gates, harness, store, handlers, report, doctor), hookgate — Claude Code (and Codex) plugin (+17 more)

### Community 4 - "Backlog Tooling"
Cohesion: 0.14
Nodes (23): apply(), ensureLabels(), ensureMilestone(), existingIssues(), issueBody(), LABELS, lint(), main() (+15 more)

### Community 5 - "Site Generator"
Cohesion: 0.10
Nodes (20): body, description, dropEmptyHead(), esc(), jsonLd, lastmod, { lede, after }, linkifyPaths() (+12 more)

### Community 6 - "Release & Sync Workflows"
Cohesion: 0.22
Nodes (19): Backlog issue sync (one-way), CI backlog job (lint, check, planner test), Skip already-published version (bootstrap), Release drift check, Close the milestone step, npm Trusted Publishing over OIDC, Release pipeline (on tag hookgate--v*), BACKLOG.md as single source of truth (+11 more)

### Community 7 - "CLI Entry & Report"
Cohesion: 0.18
Nodes (16): check(), checkHooksFile(), [cmd = 'help'], handler(), HANDLERS, help(), HOOK_EVENTS, json() (+8 more)

### Community 8 - "Test Suite"
Cohesion: 0.19
Nodes (13): answers, baseEnv(), BIN, exec(), requests, run(), allow, ask (+5 more)

### Community 9 - "Social Preview Card"
Cohesion: 0.36
Nodes (8): hookgate social preview card, Confident: act. Unsure: ask. Unreachable: get out of the way., Calibrated, sub-second decisions inside Claude Code's hooks, TypeSafe's Jev answers with a confidence score, hookgate logo mark (blue rounded tile, gate glyph), PreToolUse gate on shell commands, github.com/Allan-Nava/hookgate · MIT, Stop gate on unverified completion

### Community 10 - "Logo Mark"
Cohesion: 0.38
Nodes (7): hookgate logo (assets/logo.svg), Rounded square tile, steel blue #2f5d8a, 64x64 grid, 14px corner radius, Inner crossbar: short horizontal rail between the posts, white at 85% opacity, Gate frame: top lintel bar plus two vertical posts (open-bottomed arch), solid white, Gate mark: white gate/portal frame with crossbar and latch dot on a blue rounded tile, Latch dot: centred circle below the crossbar, white at 85% opacity, Visual metaphor: a gate that webhooks pass through, the bar and dot as the check/latch at the threshold

### Community 11 - "Monochrome Logo"
Cohesion: 0.53
Nodes (6): Monochrome currentColor variant: no tile, inherits text colour, 64x64 grid, Gate frame: lintel and two posts, Gate metaphor: a webhook gate that admits or holds incoming events, Latch bar: short crossbar inside the gate (85% opacity), Dot below the latch: the event or payload held at the gate (85% opacity), hookgate monochrome logo (logo-mono.svg)

### Community 12 - "Redaction"
Cohesion: 0.67
Nodes (4): PATTERNS, prepare(), redact(), truncate()

### Community 13 - "Renovate Config"
Cohesion: 0.40
Nodes (4): config:recommended, helpers:pinGitHubActionDigests, extends, $schema

## Ambiguous Edges - Review These
- `Unverified completion gate (Stop)` → `Q7 · Does the Stop gate call Jev on every stop`  [AMBIGUOUS]
  thoughts/HG-1-jev-gates/00-questions.md · relation: references
- `.claude/hookgate.json configuration` → `Q2 · May a repo config loosen the gate`  [AMBIGUOUS]
  thoughts/HG-1-jev-gates/00-questions.md · relation: references
- `Stop gate on unverified completion` → `hookgate logo mark (blue rounded tile, gate glyph)`  [AMBIGUOUS]
  assets/social-preview.png · relation: semantically_similar_to

## Knowledge Gaps
- **86 isolated node(s):** `ROOT`, `[cmd = 'help']`, `HOOK_EVENTS`, `HANDLERS`, `INJECTION_TOOLS` (+81 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Unverified completion gate (Stop)` and `Q7 · Does the Stop gate call Jev on every stop`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `.claude/hookgate.json configuration` and `Q2 · May a repo config loosen the gate`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Stop gate on unverified completion` and `hookgate logo mark (blue rounded tile, gate glyph)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `hookgate — Claude Code (and Codex) plugin` connect `Repo Rules & CI Docs` to `Backlog Items & Project Docs`, `Release & Sync Workflows`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `HG-1 brief — Jev in Claude Code gates` connect `Repo Rules & CI Docs` to `Backlog Items & Project Docs`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `hookgate — calibrated, sub-second decisions inside Claude Code hooks` connect `Backlog Items & Project Docs` to `Repo Rules & CI Docs`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `ROOT`, `[cmd = 'help']`, `HOOK_EVENTS` to the rest of the system?**
  _86 weakly-connected nodes found - possible documentation gaps or missing edges._