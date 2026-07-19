# Contact Form Setup with Terraform

This guide explains how to set up the contact form with Cloudflare using **Terraform for infrastructure as code**.

## Overview

The contact form uses:
- **Cloudflare Email Binding** (free) - sends from the consumer Worker to a verified destination
- **Cloudflare Workers + Queues** (free tier: 100k requests/day) - API Worker validates and queues submissions; a queue consumer Worker delivers email
- **Cloudflare Turnstile** (free) - anti-spam protection
- **Terraform** - manages all infrastructure

## Local Development with LocalStack and Mailpit

For local development, the browser calls the local TypeScript API. It publishes to
LocalStack SQS, and a separate TypeScript consumer sends the resulting email to
**Mailpit** over SMTP.

- **Web UI**: http://localhost:8025
- **LocalStack endpoint**: http://localhost:4566
- **Contact API endpoint**: http://localhost:8787/api/contact
- **No configuration needed** - all services start with `kool start`
- Uses Turnstile test key (always passes validation)

### Start Local Environment

```bash
# Start Docker containers (includes LocalStack, the API, consumer, and Mailpit)
kool start

# Open Mailpit web UI
open http://localhost:8025

# Start Vite dev server
kool run yarn dev

# Open site
open http://localhost:3000/contact

# Test the form - it is queued first, then appears in Mailpit.
```

## Production Setup with Terraform

### Prerequisites

- Cloudflare account with your domain (`fbrissi.dev`)
- Domain DNS managed by Cloudflare
- Terraform installed
- GitHub repository connected to Cloudflare Pages

### Step 1: Configure Cloudflare Email Routing

1. **Enable Email Routing** (manual, one-time setup):
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Select your domain (`fbrissi.dev`)
   - Navigate to **Email** → **Email Routing**
   - Click **Get started** and follow the wizard

2. **Add destination address**:
   - Add your personal email address (e.g., `filipe@gmail.com`)
   - Verify it by clicking the confirmation link sent to that address

3. **Verify the destination address**:
    - Add and verify `f.b.rissi@gmail.com` in Email Routing.
    - The Worker Email binding is restricted to this verified destination.

### Step 2: Configure the Terraform Cloud Integrations

Terraform creates the Turnstile widget and synchronizes its keys to GitHub Actions.
No Turnstile key is created or copied manually.

Add these workspace environment variables in Terraform Cloud:

- `GITHUB_TOKEN` - a fine-grained GitHub token with **Actions: Read and write** repository permission. Mark it sensitive.

Add this GitHub Actions secret:

- `TFC_API_TOKEN` - preferably a Terraform Cloud team token. Create a dedicated team, grant it **Read** access only to the `fbrissi-dev` workspace, and create its token. The release workflow uses it only to wait for the VCS-triggered apply. Mark it secret.

Keep **Auto apply** disabled in the Terraform Cloud workspace. After reviewing the automatically generated plan, apply it manually. When a merge changes `terraform/`, the release workflow waits up to six hours for the Terraform Cloud run for that commit to succeed, then creates the tag and deploys. Releases without Terraform changes skip this wait.

### Step 3: Provision and Deploy

Merge the release pull request into `main`. Terraform Cloud applies the configuration, which creates the Turnstile widget and configures:

- `VITE_TURNSTILE_SITE_KEY` as a GitHub Actions repository variable
- `TURNSTILE_SECRET_KEY` as a GitHub Actions repository secret

After that apply succeeds, the release workflow creates the tag and deploys the site and Workers.

### Recovering a Failed Release

The `Release Orchestrator` workflow starts releases after merged pull requests.
If that workflow fails after the Terraform Cloud apply, run the `Release` workflow
manually from GitHub Actions with:

- `version` - the version from the current `main` commit's `CHANGELOG.md` entry
- `prerelease` - whether to mark the GitHub release as a prerelease
- `release_notes` - optional; when omitted, the matching `CHANGELOG.md` notes are used

The manual workflow compares the current `main` commit with the previous release
tag to determine whether Terraform changed, then waits for its Terraform Cloud
apply before creating the tag. It can also resume a failed run after the tag was
created, as long as that tag points to the current commit.

## Infrastructure Managed by Terraform

Terraform manages:
- ✅ Cloudflare Pages project and custom domain
- ✅ Custom domain configuration
- ✅ Cloudflare Queue (contact form messages)
- ✅ Turnstile widget
- ✅ `contact@fbrissi.dev` forwarding rule

GitHub Actions manages the Worker scripts, routes, queue consumer, bindings, and Pages deployments.

**Manual setup** (one-time, not managed by Terraform):
- Enable Cloudflare Email Routing and verify `f.b.rissi@gmail.com` as a destination

### Migrating Existing Infrastructure

If Terraform previously managed the Workers, remove only those resources from
state before applying this version. This preserves the running Workers until the
next tag deployment takes ownership of them.

```bash
terraform state rm \
  cloudflare_workers_script.contact_api \
  cloudflare_workers_script.contact_email_consumer \
  cloudflare_queue_consumer.contact_email \
  cloudflare_workers_route.contact_form_apex \
  cloudflare_workers_route.contact_form_www
```

Then apply Terraform to retain the queue and Turnstile infrastructure. Terraform
synchronizes the Turnstile GitHub Actions variable and secret before the release
workflow creates the deployment tag.

## Testing

### Local (Mailpit)

1. Start services: `kool start`
2. Open site: http://localhost:3000/contact
3. Fill form and submit
4. Check Mailpit: http://localhost:8025
5. The API queues the submission in LocalStack; the consumer delivers it to Mailpit with a `LOCAL DEV` badge

### Production

1. Visit https://fbrissi.dev/contact
2. Fill out the form
3. Complete Turnstile captcha
4. Submit
5. Check `f.b.rissi@gmail.com`

## Terraform Commands

```bash
# Initialize
terraform init

# Format code
terraform fmt -recursive

# Validate configuration
terraform validate

# Plan changes
terraform plan

# Apply changes
terraform apply

# Show outputs
terraform output

# Destroy (careful!)
terraform destroy
```

## Updating the Workers

The API Worker is in `workers/contact-api.ts`, the consumer Worker is in
`workers/contact-email-consumer.ts`, and email templates are in
`workers/templates/contact-email.ts`. To update them:

1. Edit the TypeScript file
2. Merge the release pull request into `main` to create and deploy the release tag

## Troubleshooting

### Terraform errors

**Error: "zone_id is required"**
- Add `cloudflare_zone_id` to `terraform.tfvars`
- Find Zone ID in Cloudflare Dashboard → Overview

**Error: "turnstile widget not found"**
- Create Turnstile widget first (Step 2)
- Add secret key to `terraform.tfvars`

### Form submission fails

1. **Check Worker logs**:
   ```bash
    wrangler tail fbrissi-dev-contact-api
   ```

2. **Verify Worker route**:
   ```bash
   curl https://fbrissi.dev/api/contact \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"test":"data"}'
   ```

3. **Check Terraform outputs**:
   ```bash
   terraform output
   ```

### Email not received

1. **Verify Email Routing**:
    - Cloudflare Dashboard → Email → Email Routing
    - Verify `f.b.rissi@gmail.com` is confirmed as a destination address
    - Verify the consumer's `SEND_EMAIL` binding targets that address

2. **Check spam folder**

3. **Check the consumer Worker logs**:
    ```bash
    wrangler tail fbrissi-dev-contact-email-consumer
   ```

### Local development issues

**Mailpit not accessible**:
```bash
# Check if container is running
docker ps | grep mailpit

# Restart services
kool restart
```

**Local queue flow is not delivering**:
```bash
# Check API and consumer logs
kool logs contact-api
kool logs contact-email-consumer

# Verify LocalStack is healthy
kool logs localstack
```

## Cost Breakdown

All services used are **free**:

- ✅ **Cloudflare Email Routing**: Free (verified Email binding destinations)
- ✅ **Cloudflare Workers**: Free tier (100,000 requests/day)
- ✅ **Cloudflare Email Binding**: Free with Cloudflare Email Routing
- ✅ **Cloudflare Turnstile**: Free (unlimited verifications)
- ✅ **Cloudflare Pages**: Free tier (unlimited requests, 500 builds/month)
- ✅ **Mailpit** (local): Free (open source)

**Total monthly cost: $0**

## Security Notes

1. **Never commit secrets**:
   - `terraform.tfvars` is in `.gitignore`
   - Use Terraform variables for sensitive data

2. **Turnstile protection**:
   - Blocks bots and spam
   - Validated server-side in Worker

3. **Email validation**:
   - Client-side and server-side validation
   - Turnstile prevents automated submissions

4. **CORS**:
    - API Worker accepts requests from `https://fbrissi.dev`
   - Adjust `corsHeaders` in Worker if needed

## Architecture Diagram

```
┌─────────────────┐
│  User Browser   │
│ fbrissi.dev     │
└────────┬────────┘
         │ POST /api/contact
         │ + Turnstile token
         ▼
┌─────────────────┐
│ Cloudflare API  │
│ Worker          │◄───── Terraform manages
│ (contact-api)   │
└────────┬────────┘
          ├───────────► Turnstile validation
          │
          ▼
┌─────────────────┐
│ Cloudflare Queue│
└────────┬────────┘
         ▼
┌─────────────────┐
│ Email consumer  │
│ Worker          │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Email Binding   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Email Routing   │◄─── Manual setup
└────────┬────────┘
         ▼
┌─────────────────┐
│ Your Personal   │
│ Email           │
└─────────────────┘
```

## References

- [Cloudflare Terraform Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [Cloudflare Email Routing Docs](https://developers.cloudflare.com/email-routing/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Queues Docs](https://developers.cloudflare.com/queues/)
- [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/)
- [MailChannels API Docs](https://api.mailchannels.net/tx/v1/documentation)
- [Mailpit](https://github.com/axllent/mailpit)

---

**Setup completed!** Infrastructure managed via Terraform, local development with Mailpit, zero monthly costs.
