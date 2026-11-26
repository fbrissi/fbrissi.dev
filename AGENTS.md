# AI Agents Context for fbrissi.dev

Static bilingual portfolio built with Next.js, React 19, TypeScript, and Tailwind CSS, deployed to Cloudflare Pages.

## Architecture

- Next.js statically exports the site to `out/`.
- Cloudflare Pages serves the static export from `out/`.
- English routes use the root path; Portuguese routes use `/pt-br`.
- `src/app/` defines the Next.js App Router routes and metadata.
- Markdown content is compiled into a build-generated typed manifest.
- Contact handling remains in Cloudflare Workers under `workers/`.
- The English study groups program has public, indexed pages in both locales (landing at `/study-groups` and `/pt-br/grupos-de-estudo-de-ingles`, the only page whose Portuguese slug differs, listed in `scripts/localized-slugs.json`, which the site, sitemap and redirects read; terms at `/study-groups/terms`; and the site-wide `/privacy` policy, versioned with the program's consent) and English-only, noindex app pages (board and settings at `/study-groups/g/<id>` through a `_redirects` 200 rewrite to static shells, plus `/study-groups/{new,my,account,welcome,admin,unsubscribe}`).
- Study groups language rule (owner decision): the program is English immersion, so practice starts with reading. The app, group boards, sign-up flow, service emails and group content stay English-only; never translate them or add a `/pt-br` app route. The pt-BR landing exists only as an entry door for Portuguese searches: only its page title, meta description and one prominent alert are in Portuguese (the alert says the page is in English on purpose, because the practice starts with reading); everything else is the English landing body, and it sends visitors to the English app. Terms and the privacy policy stay bilingual for LGPD.
- The `study-group-api` Worker handles Google sign-in (Authorization Code + PKCE, `__Host-` session cookie), groups, membership, moderation, an hourly meeting reminder cron and a daily retention cron, backed by Cloudflare D1; migrations live in `workers/study-group/migrations/`. Never edit an applied migration.
- The sandbox environment is disabled: `sandbox_enabled = false` in `terraform/locals.tf` removes all its infrastructure (Pages project and domain, D1, queues, SES key, GitHub secrets), and `.github/workflows/sandbox.yml` runs only when the repository variable `SANDBOX_ENABLED` is `true`. The Workers' `[env.sandbox]` blocks stay as the reference: each sandbox Worker (`*-sandbox`) is bound only to its own routes, D1, queues and SES key, and Deploy Sandbox must never migrate or deploy production. Production configuration must never bind a sandbox resource.
- Study group email notifications (English only): routes write an outbox row (`notifications`) in the same D1 batch as the state change and queue only its ID (delayed for the trailing owner digest); the separate mailer Worker (`workers/study-group-mailer/`) is the only holder of the SES key, claims each row before sending, and sends through SES v2 with a hand-written SigV4 (`workers/study-group/sigv4.ts`). Locally the API sends in-process to Mailpit.
- No soft delete in the study groups program: every deletion removes the rows (and R2 objects) at once, with no restore; UI deletes must say the action is permanent and name what goes with it. Bans only hide a banned user's content while the ban lasts; a ban record expires 2 years after the ban or its last renewal (daily cron). Admin moderation actions ask for the reason in the in-page dialog (`reason-dialog.tsx`), and every other confirmation uses its `confirm` mode; never `window.prompt` or `window.confirm`. Program contact is `groups@fbrissi.dev` (`STUDY_GROUPS_EMAIL`, Reply-To of every notice); `contact@` stays the portfolio contact. Every email renders through `workers/templates/email-layout.ts`.
- Group icons live in the private R2 bucket `fbrissi-dev-study-group-icons`, are served only through the API Worker's hourly HMAC-signed URLs (key derived from the session secret), are checked by content (PNG/JPEG/WebP, 256 KB, 512 × 512) and stored without metadata. They show in the app and, for listed groups only, on the public landing cards (the public list returns a signed `iconUrl`); a group without an icon shows the first letter of its name on the orange accent (`GroupIcon` in `group-icon.tsx`) wherever icons appear.
- Privacy Policy changes: bump `POLICY_VERSIONS` for any edit; also bump `MATERIAL_POLICY_VERSIONS` (forcing re-acceptance) only for material changes (new providers, purposes, legal bases, transfers or user obligations). Keep `docs/lgpd/record-of-processing.md` and `docs/lgpd/security-policy.md` (internal, not published) consistent with the policy and the code.
- Never expose a user's email address to other users, in API responses, emails, queue messages or logs: emails never include requester names or join messages, and logs carry only row IDs. Only `POST /api/study-group/unsubscribe` skips the CSRF check; its signed token is the credential.
- Error monitoring: the four Workers (`withSentry`, `workers/observability/sentry.ts`) and the browser (`src/instrumentation-client.ts`, loaded only when the build has `NEXT_PUBLIC_SENTRY_DSN`) report errors to the `fbrissi-dev` Sentry project in the `oliblish` organization (shared with nota-profile, created by `terraform/sentry.tf`). Only errors, never traces, logs or metrics; every event and breadcrumb passes `workers/observability/sentry-policy.ts` (no user, cookies, headers, bodies or query strings; emails redacted). Report caught errors with `reportError`. Without a DSN (sandbox, local, tests) nothing is sent.
- The production Worker always uses Google's fixed endpoints; the fake Google IdP (`workers/local/fake-idp.ts`) runs only in the local Docker stack.

## Structure

```text
public/                       Static assets and Cloudflare configuration
src/
  app/                        Next.js App Router and root layout
  components/content/         Shared content presentation
  components/layout/          Shared site chrome
  content/                    Localized Markdown and profile JSON
  features/contact/           Contact form feature
  i18n/messages/              Localized UI messages
  lib/                        Content, i18n, and SEO utilities
  site-pages/                 Shared route-level page components
  generated/                  Build-generated content manifest
  index.css                   Global Tailwind styles
test/                         Vitest tests
workers/                      Production and local contact workers
scripts/                      Build helpers
terraform/                    Cloudflare infrastructure
next.config.ts                Next.js configuration
```

## Development

Use Kool for Yarn commands. Do not run Yarn directly on the host.

### Node Dependency Safety

Before recommending, adding, or installing any new Node.js dependency or development dependency, you MUST load and follow the `safe-node-package` skill. Do not choose an npm package name from memory and do not modify `package.json` or `yarn.lock` until the skill's identity, trust, compatibility, and security checks approve the exact package and version.

```bash
kool run setup
kool start
kool run yarn dev
kool run yarn lint
kool run yarn typecheck
kool run yarn test
kool run yarn build
```

The application runs at `http://localhost:3000`. Mailpit runs at `http://localhost:8025`. The local study group API runs at `http://localhost:8788` and the fake Google IdP at `http://localhost:8790`.

## Content

- Articles: `src/content/articles/{locale}/*.md`
- Projects: `src/content/projects/{locale}/*.md`
- Works: `src/content/works/{locale}/*.md`
- Profile data: `src/content/profile/{locale}.json`
- Profile copy: `src/content/profile/{locale}.md`
- Messages: `src/i18n/messages/{locale}.json`

Supported locales are `en` and `pt-BR`.

## Environment

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: public Turnstile key embedded in the client build
- `VITE_TURNSTILE_SITE_KEY`: legacy public Turnstile key retained for older tagged releases
- `NEXT_PUBLIC_CONTACT_API_URL`: optional local contact API override
- `NEXT_PUBLIC_SITE_URL`: optional canonical site URL override
- `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_RELEASE`: build-time Sentry DSN and release of the browser SDK (set by the Deploy workflow from the Terraform-published `SENTRY_DSN` variable and the tag); the Workers get `SENTRY_DSN` and `SENTRY_RELEASE` as `--var`
- `STUDY_GROUP_API_PROXY_URL`: study group API that `next dev` proxies `/api/study-group/*` to
- `STUDY_GROUP_SLUG`: build-time slug of the retired `/study-group/<slug>` board, turned into a 301 in the generated `public/_redirects`; never commit it
- Worker secrets pushed by the deploy workflows: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `STUDY_GROUP_PLATFORM_ADMIN_EMAILS`, `STUDY_GROUP_SESSION_SECRET`, `STUDY_GROUP_UNSUBSCRIBE_SECRET`; Terraform publishes the Google, admin and unsubscribe ones (the first three from Terraform Cloud variables, the unsubscribe one from `random_password`), plus the Terraform-published `STUDY_GROUP_SES_ACCESS_KEY_ID` and `STUDY_GROUP_SES_SECRET_ACCESS_KEY` (mailer only); the sandbox, when enabled, also uses `STUDY_GROUP_EMAIL_ALLOWLIST` and its own `STUDY_GROUP_SANDBOX_SES_*` key. The Google OAuth client is created by hand (README, Study Groups)

## Releases

Every release must add exactly one `CHANGELOG.md` entry headed `## vMAJOR.MINOR.PATCH`. Merging that pull request into `main` waits for the Terraform Cloud apply when `terraform/` changed, then creates the matching GitHub release and tag and dispatches the deploy.

- Deploys use the Terraform-managed `CLOUDFLARE_DEPLOY_API_TOKEN`; `CLOUDFLARE_API_TOKEN` is only the Terraform credential.
- Production deploys only Semantic Versioning tags reachable from `main`.
- `.github/workflows/rotate-credentials.yml` copies the manual Cloudflare token to Terraform Cloud (`bootstrap` and `manual` modes), and twice a year also replaces the deployment token and Turnstile widget and redeploys the latest tag (`automatic` mode).
- Dependabot groups all updates into one pull request on the default branch, assigned to `fbrissi` (Terraform provider and TypeScript majors are ignored and upgraded manually); bring its changes into a pull request into `main` that adds a new `CHANGELOG.md` release (merging it releases and deploys).
- `.github/workflows/ai-dependency-update.yml` runs the shared `dependency-update` AI task weekly (profile `docs/ai/dependency-updates.md`): security fixes from the Dependabot pull request go to a `hotfix/dependency-updates-<date>` pull request into `main` with its `CHANGELOG.md` release (merging it releases and deploys), the rest to a `bugfix/dependency-updates-<date>` pull request into the open `release/*` branch, or wait for one. A person reviews and merges them.

## Terraform Credentials

- When a change under `terraform/` adds a provider resource or data source type, a `cloudflare_ruleset` phase, or changes what an existing resource manages, update `terraform/cloudflare-token-permissions.json` and `terraform/README.md`; the shared `fbrissi/github-actions` terraform-permissions check validates both in CI.
- Before the pull request is merged, tell the owner exactly which permission to add to which credential: the Cloudflare Terraform token (`CLOUDFLARE_API_TOKEN`), the manually created AWS role `fbrissi-dev-terraform`, or the `rissi-terraform` GitHub App.
- Do not merge while the `Terraform / Cloudflare token permissions` check is red; the release apply would fail the same way.

## Validation

```bash
kool run yarn lint
kool run yarn typecheck
kool run yarn test:coverage
kool run yarn build
kool run yarn e2e:features
kool run e2e
```

- The E2E suite is specified in Gherkin under `e2e/features/`; each scenario (each Examples row of an outline) is a plain Playwright test with exactly its title in `e2e/*.e2e.ts`, and `yarn e2e:features` fails on a scenario without a test or a test without a scenario. `playwright-bdd` was not adopted (no stable release for the pinned Playwright). Change the scenario and the test together.
- CI runs the suite in the `Quality / e2e` job (`.github/workflows/quality-checks.yml`) with `docker compose -f docker-compose.yml -f docker-compose.ci.yml` and `e2e/run.sh`, without kool or secrets. It runs on non-draft pull requests only (a skipped run counts as passing in the Quality Checks gate) and pulls its images fresh, without an image cache.

Keep changes minimal, preserve both locales, and verify direct navigation for changed routes.
