---
title: "fbrissi.dev"
description: "A bilingual, content-driven engineering portfolio with Cloudflare infrastructure, automated delivery, strict quality gates, and AI-assisted code review."
url: "https://github.com/fbrissi/fbrissi.dev"
stack:
  - React 19
  - TypeScript
  - Vite
  - Cloudflare
  - Terraform
  - GitHub Actions
  - Vitest
  - AI-assisted Engineering
order: 1
---

`fbrissi.dev` is the public repository behind this portfolio. It is designed as a small production system rather than a static collection of pages: content, application code, serverless services, infrastructure, testing, releases, and AI-assisted review all live in one auditable codebase.

[Explore the source code on GitHub](https://github.com/fbrissi/fbrissi.dev).

## Product and frontend architecture

The user-facing application is a bilingual React 19 site built with **Next.js, TypeScript, and Tailwind CSS**, using static export for Cloudflare Pages. English routes live at the root and Portuguese routes under `/pt-br`, with every page pre-rendered at build time.

Editorial content is separated from presentation and stored as localized Markdown and JSON. The build generates a typed content manifest, while reusable parsing and collection utilities provide access to articles, projects, work history, and profile information.

The frontend also includes:

- responsive layouts for desktop and mobile
- route-specific titles, descriptions, canonical URLs, and language alternates
- Open Graph and Twitter metadata
- JSON-LD for people, websites, and articles
- generated `sitemap.xml` and `robots.txt`
- accessible navigation and localized recovery pages

## Serverless contact workflow

The contact form is implemented as an asynchronous Cloudflare architecture:

1. The browser validates the form and obtains a **Cloudflare Turnstile** token.
2. A Cloudflare Worker validates the request and captcha before accepting it.
3. The Worker publishes a normalized message to **Cloudflare Queues**.
4. A separate queue consumer builds text and HTML email variants and sends them through a Cloudflare Email binding.

Queueing decouples the public request from email delivery, keeps API responses fast, and allows failed deliveries to be retried without asking the visitor to resubmit the form. Input validation, restricted CORS, Turnstile verification, header sanitization, and secret bindings reduce the public attack surface.

## Infrastructure as Code

Terraform manages the Cloudflare Pages project, custom domain, contact queue, Turnstile widget, and the GitHub Actions variable and secret required by deployments. Terraform Cloud remains part of the release path: releases that modify infrastructure wait for the corresponding apply before tagging and deploying application code.

Local development mirrors production responsibilities with **Kool, Docker Compose, LocalStack SQS, and Mailpit**. This makes the complete form, queue, consumer, and email workflow testable without using production services.

## CI/CD and release engineering

GitHub Actions runs independent quality jobs for linting, TypeScript, production builds, test coverage, and Terraform validation. Tests use Vitest, Testing Library, and V8 coverage with a repository-wide **100% threshold for statements, branches, functions, and lines**.

The release workflow adds several operational safeguards:

- pull requests must introduce exactly one Semantic Versioning changelog entry
- release tags are validated before deployment
- Terraform changes wait for the matching Terraform Cloud run
- tagged builds deploy the static application to Cloudflare Pages
- contact Workers deploy independently through Wrangler
- concurrency controls prevent overlapping production deployments

## AI-assisted engineering

AI is integrated into the engineering workflow rather than presented as an application feature. After quality checks pass, a dedicated GitHub Actions workflow installs **OpenCode**, authenticates through a scoped GitHub App, and runs an automated pull-request review with a configurable model and reasoning variant.

The repository includes project-specific agent guidance describing architecture, commands, content conventions, security constraints, and validation expectations. This gives AI coding and review tools accurate repository context while keeping their output subject to the same tests, coverage requirements, review process, and release controls as human-authored changes.

## Skills demonstrated

This project exercises practical experience across several engineering disciplines:

- **Frontend:** React, TypeScript, routing, responsive design, accessibility, Markdown rendering, and SEO
- **Backend:** request validation, serverless APIs, asynchronous processing, email composition, and retry behavior
- **Cloud:** Cloudflare Pages, Workers, Queues, Turnstile, Email Routing, and secret bindings
- **Infrastructure:** Terraform, Terraform Cloud, environment separation, and Infrastructure as Code
- **Delivery:** GitHub Actions, release automation, Semantic Versioning, deployment orchestration, and quality gates
- **Testing:** unit, component, route, Worker, integration-style local infrastructure tests, and strict coverage enforcement
- **Architecture:** content boundaries, static-first delivery, event-driven workflows, security controls, and operational simplicity
- **AI:** repository-aware coding assistance, automated pull-request analysis, model configuration, and review automation
