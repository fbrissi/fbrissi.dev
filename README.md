# fbrissi.dev

Public portfolio for Filipe Bojikian Rissi.

## Stack

- Vite
- React
- React Router
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

- Vite production build output in `dist/`
- English pages at the root path
- Portuguese pages under `/pt-br`
- Content stored in JSON and Markdown files
- Articles, contributions, projects, and works are rendered from Markdown with raw HTML and syntax highlighting
- Content collections live in `src/content/{articles,contributions,projects,works}/{locale}/`
- SEO handled with document metadata, generated `robots.txt` and `sitemap.xml`, and JSON-LD

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
├── pages/               # Route-level components
├── main.tsx
└── index.css
index.html
scripts/
terraform/
vite.config.ts
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

Required secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `TURNSTILE_SECRET_KEY`

Required repository variable:

- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `VITE_TURNSTILE_SITE_KEY`

Optional environment variable:

- `VITE_SITE_URL` for canonical URLs and metadata generation
- `VITE_CONTACT_API_URL` to override the contact API URL

## Terraform Configuration

Configured in `terraform/locals.tf`:

- Cloudflare account ID
- Pages project name, production branch, and custom domain

## Cloudflare Setup

### 1. Cloudflare Pages

1. Provide the Cloudflare API token and account ID to Terraform and GitHub Actions.
2. Apply `terraform/` to create the Pages project, custom domain, queue, and Turnstile widget.
3. Set the repository variable `CLOUDFLARE_PAGES_PROJECT_NAME`.
4. Deploy the Pages site and contact Workers by pushing a `v*` tag or running the Deploy workflow for a specific tag.

### 2. Contact Form

The contact form uses **free** Cloudflare services to send emails without any monthly costs:

- **Cloudflare Email Binding** - delivers from the consumer Worker to a verified destination (free)
- **Cloudflare Workers + Queues** - API Worker queues submissions and a separate Worker delivers email asynchronously
- **Cloudflare Turnstile** - anti-spam protection (free)
- **LocalStack Community SQS + Mailpit** - local equivalents for the queue and email delivery flow

**Setup Guide**: See [`docs/CONTACT_FORM_SETUP.md`](docs/CONTACT_FORM_SETUP.md) for complete instructions.

**Local Development**:

1. Start services: `kool start` (includes the local API, LocalStack SQS, queue consumer, and Mailpit)
2. Test form: http://localhost:3000/contact
3. The API queues the message in LocalStack and the consumer sends it to Mailpit.
4. Open Mailpit at http://localhost:8025 to inspect delivered messages.

**Production Deployment**:

1. Configure Cloudflare Email Routing manually (one-time)
2. Get Turnstile keys from Cloudflare dashboard
3. Copy `terraform/example.tfvars` to `terraform/terraform.tfvars`
4. Set all variables (API token, account ID, zone ID, Turnstile keys, emails)
5. Apply infrastructure: `terraform apply`
6. Add `VITE_TURNSTILE_SITE_KEY` as a repository variable and `TURNSTILE_SECRET_KEY` as a repository secret
7. Push a `v*` tag to deploy the site and Workers

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
