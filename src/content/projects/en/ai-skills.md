---
title: "ai-skills"
description: "A personal library of agent skills and Claude Code agents that turn day-to-day engineering work, from ticket planning to code review, QA and merge decisions, into repeatable workflows."
url: "https://github.com/fbrissi/ai-skills"
stack:
  - Agent Skills
  - Claude Code
  - OpenCode
  - Codex CLI
  - Rulesync
  - Bash
  - GitHub CLI
order: 3
---

`ai-skills` is a public, MIT-licensed library of reusable skills for AI coding agents. Each skill is a written procedure an agent follows for a specific job, such as reviewing a pull request or running QA in a browser, with its inputs, steps and the checks that decide when the job is done.

[Explore the repository on GitHub](https://github.com/fbrissi/ai-skills).

## One source, several harnesses

The skills follow the open [Agent Skills](https://agentskills.io) format and run on Claude Code, OpenCode, Codex CLI, Cursor and GitHub Copilot. Sources live in a single `.rulesync/` folder, and [Rulesync](https://github.com/dyoshikawa/rulesync) generates each harness's folder and the Claude Code plugin from it, so a change is written once and reaches every tool.

They install with the `skills` CLI, per project or per user, or as the `ai-skills` Claude Code plugin. Releases are versioned, so a project can pin the version it depends on.

## The skills

| Group | Skills |
| --- | --- |
| Tickets | `ticket-plan`, `ticket-ask`, `ticket-create` |
| Pull requests | `pr-create`, `pr-fix`, `pr-checks`, `review-changes` |
| Orchestration | `dev`, `ship`, `todo` |
| Quality | `bdd-scenarios`, `qa-e2e`, `quality-cycle` |
| Operations | `observability-triage`, `merge-risk` |
| Guidelines | `learn`, `skill-authoring` |
| Brazil | `inpi-trademark-watch`, `nfse-technical-note-analysis` |

A few of them, in practice:

- **`review-changes`** reviews local changes, a branch or a pull request, grades it from 1 to 5 stars with findings ranked by severity, and can publish a formal review with inline comments.
- **`dev`** implements a ticket end to end: orient in the codebase, make the smallest complete change, validate it, and hand off or ship.
- **`pr-fix`** reads review comments and failing CI, fixes what is valid and replies to each thread with the fix or a reasoned disagreement.
- **`qa-e2e`** runs BDD scenarios in a real browser at desktop and mobile sizes and returns an approve or request-changes verdict with screenshots.
- **`quality-cycle`** alternates review, QA and fixes on a branch until both the reviewer and QA approve, up to a round limit.

## Agents built on the skills

For Claude Code, the repository also ships agents that combine the skills. Workers (`code-reviewer`, `qa-tester`, `developer`, `ci-investigator`) do one job in an isolated context. Orchestrators (`milestone-delivery`, `pr-shepherd`, `incident-responder` and others) delegate to them, for example taking a milestone's issues through implementation, review, QA and a pull request. Agents that can merge only do so with auto-merge turned on, a human approval and a risk rating within the limit.

## Where it runs

The reusable Code Review workflow in [`fbrissi/github-actions`](https://github.com/fbrissi/github-actions) installs `review-changes` from a pinned `ai-skills` release, and this site's pull requests are reviewed through that workflow.

## Skills demonstrated

- **AI engineering:** agent workflows with explicit inputs, steps, stopping rules and human checkpoints
- **Developer tooling:** one source generated for several harnesses, packaged as a plugin and a CLI install
- **Delivery:** review, QA and CI automation that fits a regular pull-request flow
- **Release engineering:** versioned releases that consumers pin
