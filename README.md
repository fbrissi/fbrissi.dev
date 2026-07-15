# fbrissi.dev

Public portfolio for Filipe Bojikian Rissi.

## Stack

- Next.js App Router
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

- Static export via `next build` -> `out/`
- English pages at the root path
- Portuguese pages under `/pt-br`
- Content stored in JSON and Markdown files
- Articles, projects, and works are rendered from Markdown with raw HTML and syntax highlighting
- Content collections live in `content/articles/{locale}/`, `content/projects/{locale}/`, and `content/works/{locale}/`
- SEO handled with the Metadata API, `robots.txt`, `sitemap.xml`, and JSON-LD

## Releases

This project follows [Semantic Versioning](https://semver.org/) and records each
release in `CHANGELOG.md` using a `## vMAJOR.MINOR.PATCH` heading.

- Pull requests to `main` must add exactly one new release note.
- Merging a pull request into `main` creates the matching Git tag and GitHub release.
- Deployments run for pushed `v*` tags or manually for a selected tag.

## Folder Structure

```text
app/
components/
content/
messages/
public/
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
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

Required repository variable:

- `CLOUDFLARE_PAGES_PROJECT_NAME`

Optional environment variable:

- `NEXT_PUBLIC_SITE_URL` for canonical URLs and metadata generation

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
6. Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` from Terraform outputs to GitHub secrets
7. Push a `v*` tag to deploy the site and Workers

**Total cost: $0/month** ✅

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
