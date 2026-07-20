# AI Agents Context for fbrissi.dev

Static bilingual portfolio built with Vite, React 19, TypeScript, and Tailwind CSS, deployed to Cloudflare Pages.

## Architecture

- Vite builds the SPA to `dist/`.
- Cloudflare Pages uses `public/_redirects` to serve `index.html` for application routes.
- English routes use the root path; Portuguese routes use `/pt-br`.
- `src/app/router.tsx` defines React Router routes.
- `src/app/metadata.ts` manages route document metadata.
- Markdown content is imported at build time with Vite `import.meta.glob`.
- Contact handling remains in Cloudflare Workers under `workers/`.

## Structure

```text
public/                       Static files and Cloudflare redirects
src/
  app/                        Router, metadata, and root application
  components/content/         Shared content presentation
  components/layout/          Shared site chrome
  content/                    Localized Markdown and profile JSON
  features/contact/           Contact form feature
  i18n/messages/              Localized UI messages
  lib/                        Content, i18n, and SEO utilities
  pages/                      Route-level page components
  main.tsx                    React entry point
  index.css                   Global Tailwind styles
test/                         Vitest tests
workers/                      Production and local contact workers
scripts/                      Build helpers
terraform/                    Cloudflare infrastructure
index.html                    Vite HTML entry
vite.config.ts                Vite configuration
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

- `VITE_TURNSTILE_SITE_KEY`: public Turnstile key embedded in the client build
- `VITE_CONTACT_API_URL`: optional local contact API override
- `VITE_SITE_URL`: optional canonical site URL override

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
