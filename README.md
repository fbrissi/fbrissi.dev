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
  (`/study-groups`, `/pt-br/grupos-de-estudo-de-ingles`), and English-only, `noindex` app pages (group board and settings,
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

- Secret `CLOUDFLARE_API_TOKEN`: Terraform credential with the permission
  groups listed in
  [`terraform/cloudflare-token-permissions.json`](terraform/cloudflare-token-permissions.json)
  (see [Credential permissions](terraform/README.md#credential-permissions)).
  Account and zone permissions must be separate policy blocks.
  `.github/workflows/rotate-credentials.yml` copies it to the sensitive
  Terraform Cloud Terraform variable `CLOUDFLARE_API_TOKEN`, which must hold
  the same token; run the workflow
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
- Secret `STUDY_GROUP_UNSUBSCRIBE_SECRET` (long random string, different from
  the session secret): signs the one-click unsubscribe links of the study group
  emails. Rotating it breaks the links in emails already sent
- Secret `STUDY_GROUP_EMAIL_ALLOWLIST` (only while the sandbox is enabled):
  comma-separated emails of the sandbox testers; the sandbox mailer emails
  nobody else
- Variable `SANDBOX_ENABLED`: `true` only while the sandbox is enabled in
  `terraform/locals.tf`; otherwise Deploy Sandbox only prints a notice
- The deploy workflows push the Google, admin, session and unsubscribe secrets
  to the study group API Worker, and the SES key and the unsubscribe secret
  (plus the allowlist on the sandbox) to the study group mailer Worker

Published by Terraform, do not set them manually:

- Secrets `CLOUDFLARE_DEPLOY_API_TOKEN` (scoped deployment token used by the
  production and sandbox deploys) and `TURNSTILE_SECRET_KEY`
- Secrets `STUDY_GROUP_SES_ACCESS_KEY_ID` and
  `STUDY_GROUP_SES_SECRET_ACCESS_KEY`: the access key of the
  `fbrissi-dev-study-group-mailer` IAM user, which can only call
  `ses:SendEmail` from `notifications@fbrissi.dev`. While the sandbox is
  enabled, `STUDY_GROUP_SANDBOX_SES_ACCESS_KEY_ID` and
  `STUDY_GROUP_SANDBOX_SES_SECRET_ACCESS_KEY` hold the separate key of
  `fbrissi-dev-sandbox-study-group-mailer`
- Variables `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `VITE_TURNSTILE_SITE_KEY`
  (legacy releases)

In `automatic` mode (January 1 and July 1, or on demand),
`.github/workflows/rotate-credentials.yml` replaces the deployment token, the
Turnstile widget and the study group mailer's SES key (and the sandbox mailer's,
while the sandbox is enabled), then redeploys the latest release tag. Run Deploy
Sandbox afterwards when the sandbox is enabled; the contact form may reject
submissions and study group emails wait in the queue for the few minutes
between the apply and the redeploy.

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
`mail.fbrissi.dev`), its SMTP credential and the study group mailer's sending
key (both `fbrissi-dev-*` IAM users) in the shared AWS account
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
the `fbrissi-dev-gmail-smtp` user, which can send only as `fbrissi.dev`.

DMARC is `p=reject`. Aggregate reports go to Cloudflare DMARC Management
(beta, free on every plan), not to an inbox; its Cloudflare-generated `rua`
address is set in `cloudflare_dns_record.dmarc` so an apply keeps it. To review
them, open [dash.cloudflare.com](https://dash.cloudflare.com), select the
account and `fbrissi.dev`, then go to **Email** > **DMARC Management**: the
graph shows the volume of messages and their DMARC result for up to 30 days,
**View reports** lists the reports by date, and **View all** lists every
sending source (use the source's menu > **Details**). A legitimate source that
fails there is being rejected; align it with SES or Cloudflare before it sends
again.

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

The program stays on the Cloudflare Free plan: the production API Worker `fbrissi-dev-study-group-api`
(`workers/study-group-api/`, on `fbrissi.dev` and `www.fbrissi.dev`), bound only to the production D1 database, with
Rate Limiting bindings and one daily Cron Trigger. The cron purges decided join requests after 30 days, the
moderation log after 12 months, expired sessions, the email outbox after 30 days and the icon upload counters after
a day, re-drives the email outbox, and deletes orphaned icon objects. The Deploy workflow migrates and deploys
production only, and fails before deploying anything when a required secret is empty.

**No soft delete.** Every deletion (a suggestion, a group with its members, requests, suggestions, votes, rounds and
icon, a join request message, an icon, an account) removes the rows and R2 objects at once, in the same request; there
is no restore. Migration `0004_hard_delete.sql` removed the rows earlier versions only marked as deleted; the
`deleted_at` and `deleted_by_admin` columns stay unused, because dropping them in SQLite means rebuilding indexes or
tables. Every delete in the UI says it is permanent and names what goes with it.

**Group icons** (app pages only: board, settings, My groups and the join screen; never the public list):

- Owners upload a PNG, JPEG or WebP (`PUT /api/study-group/groups/<id>/icon`, the file as the body). The Worker checks
  the magic bytes and the size in the image headers (at most 256 KB, refused before it is read in full, and
  512 × 512 pixels), strips EXIF, XMP, IPTC, comment and text chunks without any library
  (`workers/study-group/icon-image.ts`), and stores it in the private R2 bucket `fbrissi-dev-study-group-icons` under a
  new key; replacing or removing deletes the old object. The platform admin can remove an icon with a reason (moderation
  log, owner notice and an `icon_removed` email).
- Icons are served by the API Worker at `/api/study-group/icons/<group>/<file>` with an HMAC signature derived from
  `STUDY_GROUP_SESSION_SECRET` (no new secret, no S3 credentials), valid until the end of the next full hour. URLs are
  identical within an hour, so browsers and the Cache API reuse them.
- Guards: the `STUDY_GROUP_ICON_RATE_LIMITER` binding (3 per minute per user), 10 uploads per user and 5 per group per
  day, one icon per group and 3 groups per owner, and the daily orphan cleanup (objects no group points at, older than
  an hour).
- Cost: R2 bills only beyond its free tier (10 GB-month storage, 1 million Class A and 10 million Class B operations
  a month; deletes and egress are free). Storage is at most 256 KB per group (about 2.5 MB for 10 groups, 256 MB for
  1,000). Class A operations are the capped uploads and one daily list; Class B reads happen only on edge cache misses,
  about one per icon per data center per hour. Each icon request is still a Worker request (Free plan: 100,000 a day).
- Locally, icons go to `tmp/study-group/icons` through the same interface (`workers/local/fs-bucket.ts`).

**Bans.** The platform admin finds users on `/study-groups/admin` (by display name, exact email or ID; emails are never
shown) and bans, renews or unbans them with a reason (asked in an in-page dialog), all logged. A ban ends the user's sessions, deletes the groups they own
permanently (with an E4 email each), hides their suggestions, votes, memberships and join requests, and stops the same
Google account or email from signing in or signing up (`/study-groups?signin=banned`). The user gets one `account_banned`
email with the reason and how to contest it, even with service emails turned off. A ban row expires 2 years after the
ban or its last renewal (`expires_at`; the daily cron deletes expired rows, which lifts the ban). Unbanning deletes the
ban row and sends one `account_restored` email the same way; deleted groups stay deleted.

**Sandbox (disabled).** `sandbox_enabled = false` in `terraform/locals.tf` turns off every sandbox resource: the
`fbrissi-dev-sandbox` Pages project with `sandbox.fbrissi.dev` and its DNS record, the sandbox D1, the sandbox
contact and notification queues with their dead-letter queues, the sandbox SES IAM user and its key, its GitHub
secrets, and `sandbox.fbrissi.dev` in the Turnstile widget. The Workers' `[env.sandbox]` blocks and
`.github/workflows/sandbox.yml` stay as the reference for how the sandbox is built: each sandbox Worker
(`*-sandbox`) has its own routes, D1, queues and SES key, and never touches production. Deploy Sandbox only prints a
notice until the repository variable `SANDBOX_ENABLED` is `true`. To turn the sandbox back on: set
`sandbox_enabled = true` and apply, set `SANDBOX_ENABLED=true`, create `STUDY_GROUP_EMAIL_ALLOWLIST` (tester emails),
add the sandbox redirect URI `https://sandbox.fbrissi.dev/api/study-group/auth/callback` to the Google OAuth client,
and run Deploy Sandbox (the sandbox D1 starts empty).

**Email notifications** (English only, from `notifications@fbrissi.dev` with Reply-To `contact@fbrissi.dev`):

- Events: a digest to the group owner when join requests wait (with the pending count and no requester name or
  message), the decision to the requester (approved or not, neutral wording, with the 7-day wait before asking the
  same group again), and the admin deletion of a group to its owner, with the reason. The unclaimed DevTalk group
  gets its digest when the platform admin claims it.
- Digest cadence: at most one per group every 6 hours. The first request gets one right away; requests inside the
  window schedule one trailing digest for its end, sent only if requests that arrived after the last digest are
  still pending. Skipped or failed digests don't hold back the next one.
- Flow: the API Worker writes an outbox row (`notifications`, migration `0003`) in the same D1 batch as the state
  change, with a unique dedupe key, and sends only the row ID to the `fbrissi-dev-study-group-notify` queue (with a
  delay for a trailing digest). The separate mailer Worker (`workers/study-group-mailer/`,
  `fbrissi-dev-study-group-mailer`) is the only one with the SES key. It claims the row (`sending`, so a repeated
  delivery sends nothing; a claim older than 10 minutes is taken over), reads the recipient's email at send time,
  checks the preference, a cap of 20 emails per recipient and 500 in total per 24 hours, and calls SES v2
  `SendEmail` signed with SigV4 over WebCrypto. Temporary errors retry with backoff; the 6th failed attempt marks
  the row `failed`. The daily cron queues idle rows again, marks exhausted ones failed and logs the counts.
- Users turn emails off or on in `/study-groups/account`, or with the one-click unsubscribe link
  (`List-Unsubscribe` and `List-Unsubscribe-Post`, an HMAC token signed with `STUDY_GROUP_UNSUBSCRIBE_SECRET` for one
  environment, valid for a year). `POST /api/study-group/unsubscribe` is the only route without the Origin and JSON
  checks; a `GET` only opens the `/study-groups/unsubscribe` confirmation page.
- Bounces and complaints rely on the SES account-level suppression list. Email addresses are never shown to other
  users, put in the queue, or logged, and group names can't contain links or web addresses.

**Before the first release with icons (Filipe):**

1. Enable R2 on the Cloudflare account (R2 > Purchase R2; the checkout asks for a payment method even though usage stays
   inside the free tier).
2. Add **Account · Workers R2 Storage · Edit** (API group "Workers R2 Storage Write") to the Cloudflare Terraform token
   (`CLOUDFLARE_API_TOKEN`), so the apply can create the bucket. The Terraform-managed deploy token gets
   "Workers R2 Storage Read" in the same apply.
3. No new secret: the icon links are signed with a key derived from `STUDY_GROUP_SESSION_SECRET`.

**Before the first release with notifications (Filipe):**

1. Confirm SES production access: `aws sesv2 get-account --region us-east-1` must show
   `"ProductionAccessEnabled": true` and a `SendQuota`. If it doesn't, request it (`aws sesv2 put-account-details
   --production-access-enabled --mail-type TRANSACTIONAL --website-url https://fbrissi.dev ...`) and wait for AWS.
2. Create the GitHub secret `STUDY_GROUP_UNSUBSCRIBE_SECRET` (for example `openssl rand -base64 48`). The Terraform
   apply publishes `STUDY_GROUP_SES_ACCESS_KEY_ID` and `STUDY_GROUP_SES_SECRET_ACCESS_KEY` and creates the two
   production notification queues; the `fbrissi-dev-terraform` role, the Cloudflare Terraform token and the
   `rissi-terraform` App need no new permission.
3. Deploy fails before deploying anything while one of these secrets is empty.

**Manual setup (no API or Terraform support):** follow the "Manual setup by Filipe" checklist in
[issue #45](https://github.com/fbrissi/fbrissi.dev/issues/45): Google Cloud project, OAuth consent screen
(name only, scopes `openid email profile`, In production), a Web application OAuth client with the redirect URI
`https://fbrissi.dev/api/study-group/auth/callback`, and the GitHub secrets above. The sandbox redirect URI is needed
only while the sandbox is enabled.

The Workers always use Google's fixed endpoints. The fake Google IdP below exists only in the local Docker stack.

**Local Development**:

1. `kool start` also runs the study group API (`node:sqlite` in `tmp/study-group/`) and a fake Google IdP at
   http://localhost:8790. `next dev` proxies `/api/study-group/*` to the API, so cookies stay same-origin.
   Study group emails are sent in-process to Mailpit (http://localhost:8025) with a `[LOCAL]` subject prefix; a
   trailing digest waits on a timer in the API process.
2. Open http://localhost:3000/study-groups and sign in. The fake IdP lists test users: `admin@example.test`
   (platform admin), `owner@example.test`, `member@example.test`, `outsider@example.test`, and
   `unverified@example.test` (rejected, unverified email). It can also sign in any email and name.
3. Use Chromium-based browsers locally: the `__Host-` cookies are `Secure`, which browsers accept on
   `http://localhost`.
4. `kool run e2e` runs the Playwright suite against the stack (it resets the local database).

**Before merging v0.4.0: retire the sandbox**, in this order. The merge's Terraform apply runs before the
release deploy and deletes every sandbox resource, so nothing may still use the sandbox queues, D1 or Pages project
by then (Cloudflare doesn't document what a delete does to a resource that is still bound):

1. Delete the sandbox Worker left by the earlier rehearsal (it frees its route, its cron slot and its D1 binding):
   `npx wrangler delete --name fbrissi-dev-study-group-api-sandbox`.
2. Deploy the two contact Workers to production once from the release branch, so production drops the sandbox
   contact route, the sandbox queue binding and the sandbox queue consumer before the queue is deleted (their code
   is unchanged; the secrets stay):

   ```bash
   git checkout release/v0.4.0
   (cd workers/contact-api && npx wrangler deploy)
   (cd workers/contact-email-consumer && npx wrangler deploy)
   ```

   Then check that `npx wrangler queues info fbrissi-dev-sandbox-contact-form` lists no producer or consumer. If a
   consumer is still attached, remove it:
   `npx wrangler queues consumer remove fbrissi-dev-sandbox-contact-form fbrissi-dev-contact-email-consumer`.
3. Check how many deployments the sandbox Pages project has
   (`npx wrangler pages deployment list --project-name fbrissi-dev-sandbox`). Cloudflare refuses to delete a Pages
   project with many deployments; if the list is long, delete the old deployments in the dashboard (Workers & Pages,
   `fbrissi-dev-sandbox`, Deployments) first.
4. The sandbox D1 is deleted with its data (no `prevent_destroy`); export it first only if you want to keep it.
5. Leave the repository variable `SANDBOX_ENABLED` unset. `STUDY_GROUP_EMAIL_ALLOWLIST` and the sandbox OAuth
   redirect URI are no longer needed.

Alternative to letting the merge delete the sandbox: after steps 1 to 3, run a targeted destroy of the sandbox
resources in Terraform Cloud (the `*sandbox*` resources in `terraform/`) before merging, so the merge's apply has
nothing sandbox-related left to delete and a failure can be fixed before the release.

**v0.4.0 rehearsal (local)** (`0002_groups_and_accounts.sql` moves the DevTalk board into the `devtalk` group):

1. Export production into the gitignored `tmp/`, with schema and the `d1_migrations` table, so the local API
   applies only `0002` and `0003` on top:

   ```bash
   mkdir -p tmp/rehearsal
   npx wrangler d1 export fbrissi-dev-study-group --remote --output tmp/rehearsal/devtalk-v0.3.sql
   docker compose stop study-group-api
   mv tmp/study-group/local.sqlite tmp/study-group/local.sqlite.before-rehearsal
   kool docker kooldev/node:24 node -e "const { DatabaseSync } = require('node:sqlite'); new DatabaseSync('tmp/study-group/local.sqlite').exec(require('node:fs').readFileSync('tmp/rehearsal/devtalk-v0.3.sql', 'utf8'))"
   docker compose start study-group-api
   ```

2. Sign in as `admin@example.test` (it claims DevTalk) and check the old materials, rounds and votes on
   http://localhost:3000/study-groups/g/devtalk, then a join request, its digest in Mailpit, an approval and the
   account export.
3. Delete `tmp/rehearsal/` and the rehearsal database (they hold production data), and restore
   `local.sqlite.before-rehearsal` or let `kool run e2e` recreate it.

**v0.4.0 release runbook** (a short board outage is expected between the migration and the Worker deploy):

1. Tell the DevTalk members, and close or cancel any open round (the migration cancels any round still open).
   Keep the board quiet from the bookmark below until the deploy finishes: the release can wait up to 360 minutes
   for the Terraform apply, and a restore drops any write made in that gap.
2. Right before merging, record a D1 Time Travel bookmark (restores go back up to 7 days on the Free plan) and keep a
   data export outside the repository:

   ```bash
   npx wrangler d1 time-travel info fbrissi-dev-study-group
   npx wrangler d1 export fbrissi-dev-study-group --remote --output /tmp/devtalk-v0.3.sql
   ```

3. Merge the release pull request. The Terraform apply deletes the sandbox resources and creates the notification
   queues and the mailer key; the Deploy workflow then checks the required secrets, deploys Pages and the contact
   Workers, migrates the production database, and deploys the mailer and the API Worker.
4. Right after the deploy, check in production:
   - CSP: the contact page loads Turnstile and the Google sign-in completes, with no CSP violation in the console.
   - Redirects: `/open-source` answers 301 to `/projects#open-source` (and the browser keeps the fragment),
     `/study-groups/privacy` to `/privacy`, `/pt-br/study-groups` to `/pt-br/grupos-de-estudo-de-ingles`, and the
     old `/study-group/<slug>` to the DevTalk group.
   - Email: a join request to a test group sends the owner digest. Check that it arrives from "English Study Groups
     <notifications@fbrissi.dev>" (the IAM `ses:FromAddress` condition accepts the display name), with
     `List-Unsubscribe` and `List-Unsubscribe-Post` headers and DKIM, SPF and DMARC passing, and that the mailer
     Worker logs no `AccessDenied`. The one-click unsubscribe turns the email setting off.
   - Indexing: the app pages, `/study-groups/unsubscribe` and `/api/study-group/*` send `X-Robots-Tag: noindex,
     nofollow`; the landing, terms and privacy pages don't.
5. Rollback, if needed:
   1. Restore the database: `npx wrangler d1 time-travel restore fbrissi-dev-study-group --bookmark=<bookmark>`.
   2. Roll the production API Worker back to its v0.3.2 version, from `workers/study-group-api/`:
      `npx wrangler deployments list` to find it, then `npx wrangler rollback <version-id>`. Cron Triggers
      belong to the Worker, not the version, so the daily trigger keeps firing against v0.3.2, which has no
      `scheduled()` handler; remove it in the dashboard (Settings > Triggers) while rolled back. Don't redeploy
      the `v0.3.2` tag or roll the contact Workers back: their v0.3 configuration binds the deleted sandbox queue.
     Migration `0004` deleted the soft-deleted rows for good, so a v0.3.2 rollback starts without them; the D1 restore
     brings them back.
   3. Roll the Pages project back to the v0.3.2 deployment in the Cloudflare dashboard
      (Workers & Pages > `fbrissi-dev` > Deployments > Rollback). The mailer Worker can stay: v0.3.2 writes no
      outbox rows.
6. Existing members sign in and ask to join DevTalk with the current access code.
7. After the release, delete the obsolete `STUDY_GROUP_ADMIN_EMAIL` and `STUDY_GROUP_ADMIN_PASSWORD_HASH`
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
