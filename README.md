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
- English study groups program: public, indexed landing, Terms and Privacy Policy pages in both locales
  (`/study-groups`, `/pt-br/study-groups`), and English-only, `noindex` app pages (group board and settings,
  my groups, account, admin) served by static shells; groups live at `/study-groups/g/<id>` through a
  generated `_redirects` 200 rewrite. Google sign-in, groups and moderation run in the
  `fbrissi-dev-study-group-api` Worker with Cloudflare D1

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
  D1, Pages, Queues, Turnstile Sites, and Account API Tokens Write, plus Account
  Settings Read, and `fbrissi.dev` zone permissions DNS, Email Routing Rules,
  and Zone Settings Write, plus Zone Read. Account and zone permissions must be separate policy
  blocks. `.github/workflows/rotate-credentials.yml` copies it to the sensitive
  Terraform Cloud Terraform variable `CLOUDFLARE_API_TOKEN`; run the workflow
  in `bootstrap` mode before the first apply and in `manual` mode after
  replacing the token.
- Secret `TFC_API_TOKEN`: Terraform Cloud team token with write access to the
  `fbrissi-dev` workspace (organization tokens cannot create runs)
- Terraform Cloud workspace `fbrissi-dev`, Terraform variables `GITHUB_APP_ID`,
  `GITHUB_APP_INSTALLATION_ID`, and sensitive `GITHUB_APP_PEM_FILE`: the
  `rissi-terraform` GitHub App, installed only on this repository with Actions
  secrets and variables write access and nothing else
- Variable `AGENT_APP_CLIENT_ID` and secret `AGENT_APP_PRIVATE_KEY`: the
  `rissi-agent-ai` GitHub App that publishes the shared
  [Code Review](https://github.com/fbrissi/github-actions#code-review), with
  Contents write, Pull requests write, and Issues read; the shared workflow
  scopes its token to reading code and writing reviews
- Variables `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT_NAME`, and
  `NEXT_PUBLIC_OG_IMAGE`
- Variable `CI_RUNNER`: optional runner label for every workflow job (defaults
  to `ubuntu-latest`)
- Secret `STUDY_GROUP_SLUG`: secret path segment of the retired v0.3 board
  (`/study-group/<slug>`); the build turns it into a 301 to the DevTalk group
  in `_redirects`. Drop it in a later release
- Secrets `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`: the Google
  OAuth client created by hand (see [Study Groups](#3-study-groups))
- Secret `STUDY_GROUP_PLATFORM_ADMIN_EMAILS`: comma-separated verified Google
  emails of the platform admins
- Secret `STUDY_GROUP_SESSION_SECRET` (long random string): signs the
  short-lived sign-in cookies
- The deploy workflows push the last four to the study group Worker

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
- `STUDY_GROUP_API_PROXY_URL` for the study group API that `next dev` proxies
  `/api/study-group/*` to (`http://study-group-api:8788` in Docker)
- `STUDY_GROUP_SLUG` to generate the old board redirect (`local` in Docker)

## Terraform Configuration

Configured in `terraform/locals.tf`:

- Cloudflare account ID
- Pages project name, production branch, and custom domain

## AWS Access

Terraform manages only the `fbrissi.dev` SES identity (Easy DKIM, MAIL FROM
`mail.fbrissi.dev`) and its SMTP credential in the shared AWS account
`526983805816`, with the DNS records in the same apply. Terraform Cloud reaches AWS only through dynamic
provider credentials (OIDC); no AWS key is stored. The role is created manually
in the IAM console, once, before the first apply, and Terraform does not manage
it. The account-wide `app.terraform.io` OIDC provider already exists.

1. Role `fbrissi-dev-terraform` with this trust policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::526983805816:oidc-provider/app.terraform.io" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": { "app.terraform.io:aud": "aws.workload.identity" },
         "StringLike": { "app.terraform.io:sub": "organization:fbrissi:project:*:workspace:fbrissi-dev:run_phase:*" }
       }
     }]
   }
   ```

2. Inline policy `fbrissi-dev-terraform` on the role, limited to the
   `fbrissi.dev` identity and the `fbrissi-dev-*` IAM users. Add permissions
   here before merging Terraform changes that need them:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "SesIdentity",
         "Effect": "Allow",
         "Action": [
           "ses:CreateEmailIdentity", "ses:DeleteEmailIdentity", "ses:GetEmailIdentity",
           "ses:ListTagsForResource", "ses:PutEmailIdentityDkimSigningAttributes",
           "ses:PutEmailIdentityMailFromAttributes", "ses:TagResource", "ses:UntagResource"
         ],
         "Resource": "arn:aws:ses:us-east-1:526983805816:identity/fbrissi.dev"
       },
       {
         "Sid": "ProjectUsers",
         "Effect": "Allow",
         "Action": [
           "iam:CreateAccessKey", "iam:CreateUser", "iam:DeleteAccessKey", "iam:DeleteUser",
           "iam:DeleteUserPolicy", "iam:GetUser", "iam:GetUserPolicy", "iam:ListAccessKeys",
           "iam:ListAttachedUserPolicies", "iam:ListGroupsForUser", "iam:ListUserPolicies",
           "iam:ListUserTags", "iam:PutUserPolicy", "iam:TagUser", "iam:UntagUser"
         ],
         "Resource": "arn:aws:iam::526983805816:user/fbrissi-dev-*"
       }
     ]
   }
   ```

3. In the `fbrissi-dev` workspace, set the environment variables
   `TFC_AWS_PROVIDER_AUTH=true` and
   `TFC_AWS_RUN_ROLE_ARN=arn:aws:iam::526983805816:role/fbrissi-dev-terraform`.

Outbound mail: Gmail and Spark "Send mail as" `@fbrissi.dev` use SES SMTP
(`email-smtp.us-east-1.amazonaws.com`, port 587, TLS) with the
`gmail_smtp_username` and sensitive `gmail_smtp_password` Terraform outputs of
the `fbrissi-dev-gmail-smtp` user, which can send only as `fbrissi.dev`. While
the account's SES is in the sandbox, it delivers only to verified identities,
so keep `smtp.gmail.com` until production access is granted.

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

### 3. Study Groups

The program stays on the Cloudflare Free plan: two Workers built from `workers/study-group-api/` (production
`fbrissi-dev-study-group-api` on `fbrissi.dev` and `www.fbrissi.dev`, and sandbox
`fbrissi-dev-study-group-api-sandbox` on `sandbox.fbrissi.dev`, from `[env.sandbox]`), each bound only to its own
D1 database, with Rate Limiting bindings and one daily Cron Trigger each (2 of the account's 5). The cron purges
deleted groups and content after 30 days, decided join requests after 30 days, the moderation log after 12 months,
and expired sessions. The Deploy workflow only migrates and deploys production; Deploy Sandbox only migrates and
deploys the sandbox. Both fail before deploying anything when a required secret is empty.

**Manual setup (no API or Terraform support):** follow the "Manual setup by Filipe" checklist in
[issue #45](https://github.com/fbrissi/fbrissi.dev/issues/45): Google Cloud project, OAuth consent screen
(name only, scopes `openid email profile`, In production), a Web application OAuth client with these redirect
URIs, and the GitHub secrets above.

- Production: `https://fbrissi.dev/api/study-group/auth/callback`
- Sandbox: `https://sandbox.fbrissi.dev/api/study-group/auth/callback`

The Workers always use Google's fixed endpoints. The fake Google IdP below exists only in the local Docker stack.

**Local Development**:

1. `kool start` also runs the study group API (`node:sqlite` in `tmp/study-group/`) and a fake Google IdP at
   http://localhost:8790. `next dev` proxies `/api/study-group/*` to the API, so cookies stay same-origin.
2. Open http://localhost:3000/study-groups and sign in. The fake IdP lists test users: `admin@example.test`
   (platform admin), `owner@example.test`, `member@example.test`, `outsider@example.test`, and
   `unverified@example.test` (rejected, unverified email). It can also sign in any email and name.
3. Use Chromium-based browsers locally: the `__Host-` cookies are `Secure`, which browsers accept on
   `http://localhost`.
4. `kool run e2e` runs the Playwright suite against the stack (it resets the local database).

**v0.4.0 rehearsal on sandbox** (`0002_groups_and_accounts.sql` moves the DevTalk board into the `devtalk` group):

1. In the Cloudflare dashboard, remove the `sandbox.fbrissi.dev/api/study-group/*` route from the
   `fbrissi-dev-study-group-api` Worker (v0.3 served both hosts), so the new sandbox Worker can take it.
2. Copy the production DevTalk data into the sandbox database, which is still on `0001`. Export the four tables
   only (a full export also carries `d1_migrations`), outside the repository:

   ```bash
   npx wrangler d1 export fbrissi-dev-study-group --remote --no-schema \
     --table group_info --table materials --table rounds --table votes --output /tmp/devtalk-data.sql
   npx wrangler d1 execute fbrissi-dev-sandbox-study-group --remote --command "DELETE FROM votes; DELETE FROM rounds; DELETE FROM materials; DELETE FROM group_info;"
   npx wrangler d1 execute fbrissi-dev-sandbox-study-group --remote --file /tmp/devtalk-data.sql
   rm /tmp/devtalk-data.sql
   ```

3. Run Deploy Sandbox from `release/v0.4.0`. It migrates only the sandbox database and deploys only the sandbox
   Worker; production is untouched.
4. Sign in with an allowlisted admin (it claims DevTalk) and check the old materials, rounds and votes on
   `https://sandbox.fbrissi.dev/study-groups/g/devtalk`. Check that `https://sandbox.fbrissi.dev/_redirects` returns
   404 (Pages parses it and doesn't serve it).

**v0.4.0 release runbook** (a short board outage is expected between the migration and the Worker deploy):

1. Tell the DevTalk members, and close or cancel any open round (the migration cancels any round still open).
   Keep the board quiet from the bookmark below until the deploy finishes: the release can wait up to 360 minutes
   for the Terraform apply, and a restore drops any write made in that gap.
2. Right before merging, record a D1 Time Travel bookmark and keep a data export:

   ```bash
   npx wrangler d1 time-travel info fbrissi-dev-study-group
   npx wrangler d1 export fbrissi-dev-study-group --remote --no-schema \
     --table group_info --table materials --table rounds --table votes --output /tmp/devtalk-v0.3.sql
   ```

3. Merge the release pull request. The Deploy workflow checks the required secrets first, then deploys Pages,
   migrates the production database and deploys the production Worker.
4. Rollback, if needed. Don't redeploy the `v0.3.2` tag: its `wrangler.toml` still claims the
   `sandbox.fbrissi.dev/api/study-group/*` route, which the sandbox Worker now owns, so that deploy fails.
   1. Restore the database: `npx wrangler d1 time-travel restore fbrissi-dev-study-group --bookmark=<bookmark>`.
   2. Roll the production Worker back to its v0.3.2 version, from `workers/study-group-api/`:
      `npx wrangler deployments list` to find it, then `npx wrangler rollback <version-id>`. Cron Triggers
      belong to the Worker, not the version, so the daily trigger keeps firing against v0.3.2, which has no
      `scheduled()` handler; remove it in the dashboard (Settings > Triggers) while rolled back.
   3. Roll the Pages project back to the v0.3.2 deployment in the Cloudflare dashboard
      (Workers & Pages > `fbrissi-dev` > Deployments > Rollback).
5. Existing members sign in and ask to join DevTalk with the current access code.
6. After the release, delete the obsolete `STUDY_GROUP_ADMIN_EMAIL` and `STUDY_GROUP_ADMIN_PASSWORD_HASH`
   secrets, and the local exports.

## Validation

Run these before shipping:

```bash
kool run yarn lint
kool run yarn typecheck
kool run yarn test:coverage
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
