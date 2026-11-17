# Changelog

All notable changes to this project are documented here. Release versions follow
[Semantic Versioning](https://semver.org/).

## v0.4.0

### Added

- Turn the DevTalk board into the English study groups program: a public, indexed landing page with the listed groups (name and summary only), and versioned Terms of Use (with the content policy) and Privacy Policy, in English and Portuguese, with an informational cookie notice.
- Add Google sign-in to the study group Worker (Authorization Code with PKCE S256, state and nonce, RS256 ID token verification against Google's cached JWKS), with explicit acceptance of the Terms and Privacy Policy and an 18+ confirmation before an account exists, re-acceptance when a policy version changes, 30-day `__Host-` sessions stored as SHA-256 hashes, and CSRF Origin and JSON checks.
- Let signed-in users create up to 3 groups and ask to join others with the group's access code; the owner approves requests, runs draws and votes, deletes and restores content, chooses free or reviewed suggestions, rotates the code, removes members and deletes the group.
- Add the platform admin (`STUDY_GROUP_PLATFORM_ADMIN_EMAILS`): manages every group (in groups they don't belong to, they don't suggest or vote), deletions with a mandatory 10 to 500 character reason, an audit log of deletions and restores, and in-app notices to owners.
- Add account pages to edit the display name, download a JSON export of the account data, and delete the account (owned groups are deleted, other contributions stay as "Former member").
- Add a daily Cron Trigger that purges deleted groups and content after 30 days, decided join requests after 30 days, the moderation log after 12 months, and expired sessions, and a join-with-code rate limiter.
- Add a local fake Google IdP to the Docker stack for local sign-in and E2E tests.

### Changed

- Migrate the DevTalk board (`0002_groups_and_accounts.sql`) into the `devtalk` group with no owner; the first sign-in of a platform admin claims it, and old suggestions and votes keep their typed names.
- Redirect the retired `/study-group/<slug>` URLs with a 301 to the DevTalk group, generated at build time from `STUDY_GROUP_SLUG`.
- Deploy the study group Worker with the `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `STUDY_GROUP_PLATFORM_ADMIN_EMAILS` secrets; create the Google OAuth client and these secrets before the release (README, Study Groups).
- Run the sandbox study group API as its own Worker, `fbrissi-dev-study-group-api-sandbox`, bound only to the sandbox D1 and trusting only the sandbox origin; Deploy Sandbox no longer migrates the production database or replaces the production Worker. Remove the sandbox route from the production Worker before the first sandbox deploy (README, Study Groups).
- Fail the Deploy and Deploy Sandbox workflows before deploying anything when a required secret is empty.
- Add a "Study groups" item to the site header in both locales.

### Removed

- Remove the access-code header, the typed member names (and clear the old `study-group:code` and `study-group:name` browser keys), and the email and PBKDF2 password settings login with `scripts/hash-study-group-password.mjs`; delete the `STUDY_GROUP_ADMIN_EMAIL` and `STUDY_GROUP_ADMIN_PASSWORD_HASH` secrets after the release.

## v0.3.2

### Changed

- Move the Code Review, release-note check, and release workflows to the shared reusable workflows in [`fbrissi/github-actions@v1`](https://github.com/fbrissi/github-actions). `code-review.yml`, `release.yml`, and `release-orchestrator.yml` are now thin callers, and releases gain idempotent tag and release creation.
- Dispatch Code Review on `main` instead of the pull request branch, and only after the quality checks pass (`CODE_REVIEW_ENABLED=false` turns it off), so a pull request can no longer change its own reviewer and open pull requests use the current review setup without a rebase. The review can use OpenCode or Claude Code through the `AI_HARNESS` variable and runs in the `code-review` environment.
- Split the GitHub App: `rissi-agent-ai` publishes the Code Review with a token scoped to read code and write reviews, and `rissi-terraform` manages GitHub Actions variables and secrets from Terraform Cloud.
- Update dependencies: `@aws-sdk/client-sqs` 3.1168.0, `axios` 1.21.1, `next` 16.4.6, `nodemailer` 10.5.0, `jsdom` 31.0.1, `typescript-eslint` 8.72.2, `vite` 8.3.8, and the Terraform provider lock file.
- Run the dependency audit through `scripts/audit-high.mjs`, which fails on high or critical advisories except dated entries in `audit-allowlist.json`. Allow the unpatched `picomatch` ReDoS advisory (GHSA-fc5q-39xc-vjpf), reachable only through dev and build tooling, until 2026-12-31.

## v0.3.1

### Fixed

- Parse the `wrangler d1 list --json` output without the trailing package-manager lines, so the deploy injects the study group D1 database IDs, applies the migrations, and deploys the study group API Worker (the login returned 405 because the Worker was never deployed).

## v0.3.0

### Added

- Add the unlisted DevTalk study group board at `/study-group/<slug>` (English only, `noindex`, no-referrer, out of the sitemap): members suggest materials, browse open and discussed items, and run a weekly random draw or vote; the winner is marked discussed manually. Members unlock the board with a shared access code; deletes are soft and restorable.
- Add the `/study-group/<slug>/settings` page, behind an email and PBKDF2 password login, to edit the group name, policy, meeting schedule and link, and access code, and to restore deleted materials.
- Add the `fbrissi-dev-study-group-api` Worker on `/api/study-group/*`, with the `fbrissi-dev-study-group` and `fbrissi-dev-sandbox-study-group` D1 databases (Terraform), rate limits, migrations applied on deploy, and a local `node:sqlite` service in Docker. The Terraform `CLOUDFLARE_API_TOKEN` needs the D1 Write permission and the `STUDY_GROUP_*` secrets must exist before the apply and deploy.

### Changed

- Run every workflow job on `${{ vars.CI_RUNNER || 'ubuntu-latest' }}` so the runner can be switched with the `CI_RUNNER` variable.

## v0.2.7

### Added

- Add the `fbrissi-dev-gmail-smtp` SES SMTP credential for Gmail and Spark "Send mail as" `@fbrissi.dev`, limited to `ses:SendRawEmail` on the `fbrissi.dev` identity, with the `gmail_smtp_username` and sensitive `gmail_smtp_password` Terraform outputs. The `fbrissi-dev-terraform` role needs the new `ProjectUsers` statement before the apply.

## v0.2.6

### Added

- Manage the `fbrissi.dev` SES identity in Terraform with restricted AWS access (dynamic credentials for the `fbrissi-dev-terraform` role, scoped to that identity): import the identity and its MAIL FROM created by `oliblish-dev/nota-profile`, and create the three Easy DKIM CNAMEs and the `mail.fbrissi.dev` MX and SPF records, with the MAIL FROM rejecting mail when its MX is missing.

## v0.2.5

### Changed

- Ignore major TypeScript updates in Dependabot until `typescript-eslint` supports TypeScript 7; the grouped update to 7.0.2 broke `yarn lint`.
- Ignore major Terraform provider updates in Dependabot; provider majors are upgraded manually.

## v0.2.4

### Changed

- Update react-markdown to 10.1.0, moving the Markdown styles to a wrapper element since the `className` prop was removed.
- Group every Dependabot update into a single pull request assigned to `fbrissi`, targeting the default branch.

## v0.2.3

### Changed

- Migrate to Tailwind CSS 4 with the theme defined in CSS and the `@tailwindcss/postcss` plugin.

## v0.2.2

### Changed

- Update React, pdfkit, ESLint 10, globals, TypeScript 6, Testing Library jest-dom 7, jsdom 31, and the Cloudflare Terraform provider.
- Dispatch Code Review from Quality Checks without the transition fallback.

## v0.2.1

### Changed

- Moved release-note validation into the required quality checks for pull requests targeting `main`.
- Deploy production and sandbox with a scoped Cloudflare token managed by Terraform, through Wrangler instead of the deprecated Pages action.
- Deploy only release tags reachable from `main`.
- Rotate the deployment token and Turnstile widget twice a year with the credential rotation workflow.
- Target Dependabot updates at `main`.
- Keep contact submissions that exhaust the delivery retries in dead-letter queues.
- Manage Email Routing activation and drop unknown addresses with Terraform.
- Run on Node.js 24 and update the GitHub Actions.
- Authenticate Terraform with a GitHub App and the Terraform variable `CLOUDFLARE_API_TOKEN`.
- Update Next.js, Axios, Nodemailer, Zod, PostCSS, and Vitest to fix vulnerable dependencies.

## v0.2.0

### Added

- feat: migrate the bilingual portfolio to Next.js App Router with static export
- feat: add manually triggered sandbox deployments for any selected branch at `sandbox.fbrissi.dev`
- feat: isolate sandbox contact submissions in a dedicated queue and identify sandbox emails
- feat: add environment labels for local and sandbox builds
- feat: validate contact forms with Zod and submit them through Axios

### Changed

- chore: add localized Next.js metadata, favicon configuration, and profile Open Graph imagery
- chore: persist Mailpit data in a Docker volume
- chore: rename the contact sender address from `noreply@fbrissi.dev` to `no-reply@fbrissi.dev`

## v0.1.8

### Changed

- chore: disable automatic confirmation emails until dynamic delivery is supported
- chore: update the contact email header color
- chore: rate-limit contact submissions by IP address and recipient email

## v0.1.7

### Changed

- feat: separate the contact email display recipient from the delivery address

## v0.1.6

### Added

- feat: refresh résumé content and PDF builder with pagination and heading hierarchy support
- feat: use avatar image as site favicon and apple-touch-icon
- feat: refresh Open Graph image to match current brand and avatar
- feat: add Cloudflare Pages `_headers` cache policy for assets, resumes, and brand images
- feat: send automated confirmation email to form submitter after contact form submission
- feat: localize confirmation email body based on form locale (EN/PT-BR)
- feat: add Reply-To `noreply@fbrissi.dev` header to confirmation email
- feat: add professional email signature with avatar to confirmation email
- feat: detect browser language and redirect to preferred locale on first visit
- feat: persist locale preference in localStorage; language switcher updates preference
- feat: add `contato@fbrissi.dev` Terraform email routing alias for typo resilience

### Changed

- chore: route contact email to `contact@fbrissi.dev` across local worker and email consumer config
- chore: point résumé open-source entries to portfolio pages only
- chore: remove `destination_address` restriction from `send_email` binding to allow sending to form submitters
- chore: add `locale` field to contact message queue payload; contact form POSTs locale
- chore: update success message to inform user a confirmation email will be sent
- chore: rename success button from "Try again" to "OK"
- chore: use `contact@fbrissi.dev` consistently (replace `contato@` in templates)

## v0.1.5

### Fixed

- fix: add mock for `cloudflare:email` in tests and update worker imports

## v0.1.4

### Fixed

- chore: enable observability in contact-api and email-consumer workers

## v0.1.3

### Fixed

- Extended the Terraform Cloud apply wait window for release workflows.

## v0.1.2

### Fixed

- Published tagged Cloudflare Pages releases as production deployments.

## v0.1.1

### Fixed

- Disabled the public `workers.dev` route for the queue-only contact email consumer.
- Added the missing proxied DNS record for the Pages custom domain.

## v0.1.0

### Added

- Initial public release of the bilingual portfolio in English and Brazilian Portuguese.
- Localized home, about, articles, projects, works, and contact routes.
- Markdown-backed article, project, and work collections with localized profile data.
- Responsive navigation, language switching, metadata, sitemap, robots, and structured data.
- Protected contact form using Turnstile, Cloudflare Workers, and asynchronous queue-based email delivery.
- Local contact-flow development with Docker, LocalStack, and Mailpit.
- Terraform configuration for Cloudflare Pages, the contact queue, Turnstile, and GitHub integration.
- GitHub Actions workflows for quality checks, release-note validation, semantic-versioned releases, and deployment.
