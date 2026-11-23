---
title: "English Study Groups"
description: "A free program hosted on this site where anyone can start or join an English study group: suggest material, pick a weekly topic and practice speaking together."
url: "/study-groups"
stack:
  - Next.js
  - TypeScript
  - Cloudflare Workers
  - Cloudflare D1
  - Google Sign-In
  - Terraform
  - Vitest
order: 2
---

English Study Groups is a personal initiative to help people create their own English study groups. Reading English is usually easier than speaking it, and a small group that meets every week to talk about a topic everyone prepared is a practical way to close that gap. Anyone can create or join a group; tech-focused groups are welcome too.

[Join or start an English study group](/study-groups).

## From DevTalk to an open program

The program started as the board of DevTalk, a single study group where members suggested videos, articles and books and picked the weekly topic. That board was unlisted and unlocked by a shared access code. The program turns it into something anyone can use: sign in, create a group and invite people, and DevTalk became one group among others.

## How a group works

1. Sign in with Google and accept the Terms of Use and the Privacy Policy.
2. Create a group with a name, a short public summary, rules and a meeting schedule, or ask to join one with its access code.
3. The owner approves each request, so only approved members see the board.
4. Members suggest materials; the owner picks the weekly topic by random draw or by vote.
5. The group meets on its own call and talks about the topic in English.

Owners can review suggestions before they appear, rotate the access code, remove members and permanently delete content. Each person can create up to three groups.

## Architecture

The public pages are part of this static Next.js site, in English and Portuguese. The board and settings are English-only, `noindex` pages served from static shells.

The API is a Cloudflare Worker backed by Cloudflare D1, and it runs on Cloudflare's free tier, so the program costs nothing to host. It covers:

- **Google sign-in** with the Authorization Code flow, PKCE, state and nonce, verifying the ID token against Google's public keys
- **sessions** in `__Host-` cookies, stored only as SHA-256 hashes, with CSRF origin checks
- **consent**: explicit acceptance of the Terms and Privacy Policy and an 18+ confirmation before an account exists, asked again when a policy version changes
- **moderation**: a platform admin can act on any group, with a mandatory reason, an audit log and in-app notices to owners
- **privacy controls**: users can edit their name, export their data as JSON and delete their account
- **retention**: a daily Cron Trigger purges deleted content, old join requests, the moderation log and expired sessions on a schedule
- **rate limits** on joining with a code

Production and sandbox run as separate Workers, each bound only to its own D1 database and origin. Terraform manages the databases, and migrations run on deploy. Locally, Docker runs the API with a fake Google identity provider, so sign-in can be tested end to end without touching Google.

## Skills demonstrated

- **Product:** turning a private tool into a self-service program with clear rules, policies and moderation
- **Security:** OAuth with PKCE, hardened session cookies, CSRF checks and least-privilege environments
- **Privacy:** consent records, data export, account deletion and retention jobs
- **Cloud:** Cloudflare Workers, D1, Cron Triggers and environment isolation on a zero-cost budget
- **Testing:** local identity provider and API for end-to-end tests, with the site's 100% coverage threshold
