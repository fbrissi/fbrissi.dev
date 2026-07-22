# AI Agents Context for fbrissi.dev

Static bilingual portfolio built with Next.js, React 19, TypeScript, and Tailwind CSS, deployed to Cloudflare Pages.

## Architecture

- Next.js statically exports the site to `out/`.
- Cloudflare Pages serves the static export from `out/`.
- English routes use the root path; Portuguese routes use `/pt-br`.
- `src/app/` defines the Next.js App Router routes and metadata.
- Markdown content is compiled into a build-generated typed manifest.
- Contact handling remains in Cloudflare Workers under `workers/`.

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

The application runs at `http://localhost:3000`. Mailpit runs at `http://localhost:8025`.

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

## Releases

Every release must add exactly one `CHANGELOG.md` entry headed `## vMAJOR.MINOR.PATCH`. Merging that pull request into `main` creates the matching GitHub release and tag.

## Validation

```bash
kool run yarn lint
kool run yarn typecheck
kool run yarn test:coverage
kool run yarn build
```

Keep changes minimal, preserve both locales, and verify direct navigation for changed routes.
