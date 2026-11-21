# AI Agents Context for fbrissi.dev

Static bilingual portfolio built with Next.js, React 19, TypeScript, and Tailwind CSS, deployed to Cloudflare Pages.

## Architecture

- Next.js statically exports the site to `out/`.
- Cloudflare Pages serves the static export from `out/`.
- English routes use the root path; Portuguese routes use `/pt-br`.
- `src/app/` defines the Next.js App Router routes and metadata.
- Markdown content is compiled into a build-generated typed manifest.
- Contact handling remains in Cloudflare Workers under `workers/`.
- The English study groups program has public, indexed pages in both locales (landing at `/study-groups` and `/pt-br/grupos-de-estudo-de-ingles`, the only page whose Portuguese slug differs, listed in `scripts/localized-slugs.json`, which the site, sitemap and redirects read; terms at `/study-groups/terms`; and the site-wide `/privacy` policy, versioned with the program's consent) and English-only, noindex app pages (board and settings at `/study-groups/g/<id>` through a `_redirects` 200 rewrite to static shells, plus `/study-groups/{new,my,account,welcome,admin}`).
- The `study-group-api` Worker handles Google sign-in (Authorization Code + PKCE, `__Host-` session cookie), groups, membership, moderation and a daily retention cron, backed by Cloudflare D1; migrations live in `workers/study-group/migrations/`. Never edit an applied migration.
- Production and sandbox are separate Workers from `workers/study-group-api/wrangler.toml` (`[env.sandbox]`), each bound only to its own D1 and origin. Deploy Sandbox must never migrate or deploy production.
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
- `STUDY_GROUP_API_PROXY_URL`: study group API that `next dev` proxies `/api/study-group/*` to
- `STUDY_GROUP_SLUG`: build-time slug of the retired `/study-group/<slug>` board, turned into a 301 in the generated `public/_redirects`; never commit it
- Worker secrets pushed by the deploy workflows: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `STUDY_GROUP_PLATFORM_ADMIN_EMAILS`, `STUDY_GROUP_SESSION_SECRET`. The Google OAuth client is created by hand (README, Study Groups)

## Releases

Every release must add exactly one `CHANGELOG.md` entry headed `## vMAJOR.MINOR.PATCH`. Merging that pull request into `main` waits for the Terraform Cloud apply when `terraform/` changed, then creates the matching GitHub release and tag and dispatches the deploy.

- Deploys use the Terraform-managed `CLOUDFLARE_DEPLOY_API_TOKEN`; `CLOUDFLARE_API_TOKEN` is only the Terraform credential.
- Production deploys only Semantic Versioning tags reachable from `main`.
- `.github/workflows/rotate-credentials.yml` copies the manual Cloudflare token to Terraform Cloud (`bootstrap` and `manual` modes), and twice a year also replaces the deployment token and Turnstile widget and redeploys the latest tag (`automatic` mode).
- Dependabot groups all updates into one pull request on the default branch, assigned to `fbrissi` (Terraform provider and TypeScript majors are ignored and upgraded manually); bring its changes into a `release/*` pull request, since pull requests into `main` require a new `CHANGELOG.md` release.

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
```

Keep changes minimal, preserve both locales, and verify direct navigation for changed routes.
