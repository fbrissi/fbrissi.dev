# fbrissi.dev

Public portfolio for Filipe Bojikian Rissi.

## Stack

- Next.js (static export)
- React
- TypeScript
- Cloudflare Pages
- Cloudflare Workers (contact form)
- Cloudflare Email Routing (free email forwarding)
- Cloudflare Turnstile (anti-spam)
- Terraform
- GitHub Actions
- Kool.dev
- Markdown content collections
- English and pt-BR content

## Architecture

- Next.js static export output in `out/`
- English pages at the root path
- Portuguese pages under `/pt-br`
- Content stored in JSON and Markdown files
- Articles, contributions, projects, and works are rendered from Markdown with raw HTML and syntax highlighting
- Content collections live in `src/content/{articles,contributions,projects,works}/{locale}/`
- SEO handled with Next Metadata, generated `robots.txt` and `sitemap.xml`, and JSON-LD

## Releases

This project follows [Semantic Versioning](https://semver.org/) and records each
release in `CHANGELOG.md` using a `## vMAJOR.MINOR.PATCH` heading.

- Pull requests to `main` must add exactly one new release note.
- Merging a pull request into `main` creates the matching Git tag and GitHub release.
- Deployments run for pushed `v*` tags or manually for a selected tag.

## Folder Structure

```text
public/
src/
├── app/                 # Router, metadata, and root component
├── components/
│   ├── content/         # Shared content presentation
│   └── layout/          # Shared site chrome
├── content/             # Localized Markdown and profile data
├── features/
│   └── contact/         # Contact form feature
├── i18n/messages/       # Localized UI messages
├── lib/
├── site-pages/          # Shared route-level presentation components
├── generated/           # Build-generated Markdown source manifest
└── index.css
next.config.ts
scripts/
terraform/
```

## Local Development

Use Kool for every common command:

```bash
kool run yarn install
kool run yarn dev
kool run yarn lint
kool run yarn typecheck
kool run yarn build
```

`yarn dev` and `yarn build` automatically generate the resume PDFs, `robots.txt`, and `sitemap.xml` from their source content. These outputs are ignored by Git; run `kool run yarn generate` only when they are needed without starting or building the application.

## Docker

The repository includes a minimal `Dockerfile` and `docker-compose.yml` so `kool start` can boot the app stack locally.

## Kool.dev 

- `kool run yarn install`
- `kool run yarn dev`
- `kool run yarn lint`
- `kool run yarn typecheck`
- `kool run yarn build`
- `kool start`
- `kool stop`

## GitHub Secrets and Variables

Configured manually:

- Secret `CLOUDFLARE_API_TOKEN`: Terraform credential with account permissions
  Pages, Queues, Turnstile Sites, and Account API Tokens Write, plus Account
  Settings Read, and `fbrissi.dev` zone permissions DNS, Email Routing Rules,
  and Zone Settings Write, plus Zone Read. Account and zone permissions must be separate policy
  blocks. `.github/workflows/rotate-credentials.yml` copies it to the sensitive
  Terraform Cloud Terraform variable `CLOUDFLARE_API_TOKEN`; run the workflow
  in `bootstrap` mode before the first apply and in `manual` mode after
  replacing the token.
- Secret `TFC_API_TOKEN`: Terraform Cloud team token with write access to the
  `fbrissi-dev` workspace (organization tokens cannot create runs)
- Terraform Cloud workspace `fbrissi-dev`, Terraform variables `GITHUB_APP_ID`,
  `GITHUB_APP_INSTALLATION_ID`, and sensitive `GITHUB_APP_PEM_FILE`: GitHub App
  installed on this repository with Actions secrets and variables write access
- Variables `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT_NAME`, and
  `NEXT_PUBLIC_OG_IMAGE`

Published by Terraform, do not set them manually:

- Secrets `CLOUDFLARE_DEPLOY_API_TOKEN` (scoped deployment token used by the
  production and sandbox deploys) and `TURNSTILE_SECRET_KEY`
- Variables `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `VITE_TURNSTILE_SITE_KEY`
  (legacy releases)

In `automatic` mode (January 1 and July 1, or on demand),
`.github/workflows/rotate-credentials.yml` replaces the deployment token and the
Turnstile widget, then redeploys the latest release tag. Run Deploy Sandbox
afterwards when the sandbox is in use; the contact form may reject submissions
for the few minutes between the apply and the redeploy.

Optional environment variable:

- `NEXT_PUBLIC_SITE_URL` for canonical URLs and metadata generation
- `NEXT_PUBLIC_CONTACT_API_URL` to override the contact API URL

## Terraform Configuration

Configured in `terraform/locals.tf`:

- Cloudflare account ID
- Pages project name, production branch, and custom domain

## Cloudflare Setup

### 1. Cloudflare Pages

1. Add `CLOUDFLARE_API_TOKEN` as a GitHub Actions secret and run the Rotate Deployment Credentials workflow in `bootstrap` mode.
2. Apply `terraform/` to create the Pages project, custom domain, queue, Turnstile widget, and deployment token.
3. Set the repository variable `CLOUDFLARE_PAGES_PROJECT_NAME`.
4. Deploy the Pages site and contact Workers by pushing a `v*` tag or running the Deploy workflow for a specific tag.

### 2. Contact Form

The contact form uses **free** Cloudflare services to send emails without any monthly costs:

- **Cloudflare Email Binding** - delivers from the consumer Worker to a verified destination (free)
- **Cloudflare Workers + Queues** - API Worker queues submissions and a separate Worker delivers email asynchronously; submissions that exhaust the retries go to a dead-letter queue
- **Cloudflare Turnstile** - anti-spam protection (free)
- **LocalStack Community SQS + Mailpit** - local equivalents for the queue and email delivery flow

**Setup Guide**: See [`docs/CONTACT_FORM_SETUP.md`](docs/CONTACT_FORM_SETUP.md) for complete instructions.

**Local Development**:

1. Start services: `kool start` (includes the local API, LocalStack SQS, queue consumer, and Mailpit)
2. Test form: http://localhost:3000/contact
3. The API queues the message in LocalStack and the consumer sends it to Mailpit.
4. Open Mailpit at http://localhost:8025 to inspect delivered messages.

**Production Deployment**:

1. Verify the Email Routing destination address manually (one-time)
2. Configure the Terraform Cloud and GitHub integrations in the setup guide
3. Review and apply the VCS-triggered Terraform Cloud run
4. Let the release workflow create the tag and deploy the site and Workers

**Total cost: $0/month**

## Validation

Run these before shipping:

```bash
kool run yarn lint
kool run yarn typecheck
kool run yarn build
terraform fmt -recursive
terraform init -backend=false
terraform validate
```

## Future Improvements

- Add more articles in both languages
- Add more project and work case studies
- Replace placeholder contact details with a real public email
- Add automated content previews or draft workflows
- Add visual regression tests once the design settles
