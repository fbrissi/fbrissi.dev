---
title: "github-actions"
description: "Reusable GitHub Actions workflows and composite actions for AI code review, changelog-driven releases, HCP Terraform waits and a Cloudflare token permission check, shared across personal projects."
url: "https://github.com/fbrissi/github-actions"
stack:
  - GitHub Actions
  - YAML
  - Bash
  - OpenCode
  - Claude Code
  - HCP Terraform
  - Cloudflare
order: 4
---

`github-actions` is a public, MIT-licensed repository of reusable CI/CD building blocks. It holds the parts that are the same in every project, while build matrices, deploys and credential rotation stay in each repository. Callers pin `@v1` and receive compatible releases, or pin an exact version or commit SHA.

[Explore the repository on GitHub](https://github.com/fbrissi/github-actions).

## Catalog

Reusable workflows:

- `code-review.yml`: AI review of a pull request, reported as a `Code Review` check run
- `release-note.yml`: requires each pull request to add one changelog release
- `release.yml`: tags and publishes the changelog release, then optionally deploys it
- `terraform-permissions.yml`: fails before merge when the Cloudflare Terraform token lacks a permission

Composite actions:

- `ai-harness`: installs a pinned OpenCode or Claude Code and runs one prompt
- `terraform-cloud-wait`: waits for the HCP Terraform apply of a commit
- `terraform-permissions`: checks a Cloudflare permission manifest against the real token

## AI code review

The Code Review workflow creates a check run on the pull request, runs a review with OpenCode or Claude Code, and confirms that a GitHub App published the review for the head commit. The review skill comes from a pinned [`ai-skills`](https://github.com/fbrissi/ai-skills) release, never from the pull request being reviewed.

Callers dispatch it from the default branch, so a pull request cannot change its own reviewer. The harness gets a short-lived App token scoped to read code and write reviews, and the dependency cache is restore-only during reviews, so one pull request cannot poison the cache that later reviews use.

## Releases from the changelog

`release-note.yml` fails a pull request unless it adds exactly one new `## vX.Y.Z` heading with notes. After the merge, `release.yml` resolves the version and notes from the changelog, optionally waits for the HCP Terraform apply when infrastructure changed, then creates the tag and GitHub release idempotently and dispatches the deploy workflow on the tag.

## Used by this site

This portfolio calls four of the reusable workflows: Code Review on its pull requests, the release-note check, the release orchestrator, and the Cloudflare Terraform token check. The site's own workflows are thin callers that pass inputs and secrets.

## Skills demonstrated

- **CI/CD:** reusable workflows, composite actions, Semantic Versioning for actions and major-tag pinning
- **Security:** least-privilege job permissions, scoped GitHub App tokens, pinned tools and untrusted input passed only through environment variables
- **Release engineering:** changelog-driven tags and releases, infrastructure waits and deploy dispatch
- **AI engineering:** an automated reviewer that a pull request cannot alter
