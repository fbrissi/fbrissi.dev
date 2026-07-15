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

# Start Next.js dev server
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

### Step 2: Get Cloudflare Turnstile Keys

1. Go to [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Click **Add site**
3. Configure:
   - **Site name**: `fbrissi.dev Contact Form`
   - **Domain**: `fbrissi.dev` (and `www.fbrissi.dev` if needed)
   - **Widget mode**: Managed
4. Save and copy:
   - **Site Key** (this will be output by Terraform)
   - **Secret Key** (add to terraform.tfvars)

### Step 3: Configure Terraform Variables

Create `terraform/terraform.tfvars` from the example:

```bash
cp terraform/example.tfvars terraform/terraform.tfvars
```

Edit `terraform/terraform.tfvars`:

```hcl
# Cloudflare credentials
cloudflare_api_token   = "your_api_token"
cloudflare_account_id  = "your_account_id"
cloudflare_zone_id     = "your_zone_id"

# GitHub repository
repo_owner = "fbrissi"
repo_name  = "fbrissi.dev"
repo_id    = "123456789"
owner_id   = "987654321"

# Project configuration
project_name      = "fbrissi-dev"
production_branch = "main"
custom_domain     = "fbrissi.dev"

# Contact Form
turnstile_secret_key = "your_turnstile_secret_key"
contact_email_to     = "f.b.rissi@gmail.com"
contact_email_from   = "noreply@fbrissi.dev"
```

### Step 4: Provision Infrastructure with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply infrastructure
terraform apply

# Get the Turnstile keys for GitHub secrets
terraform output turnstile_site_key
terraform output -raw turnstile_secret_key
```

### Step 5: Add Secrets to GitHub

The site key and secret key need to be added to GitHub Actions:

```bash
# Get the keys from Terraform outputs
terraform output -raw turnstile_site_key
terraform output -raw turnstile_secret_key

# Add to GitHub:
# Settings → Secrets and variables → Actions
# Name: NEXT_PUBLIC_TURNSTILE_SITE_KEY
# Value: <site key output>
#
# Name: TURNSTILE_SECRET_KEY
# Value: <secret key output>
```

Or use GitHub CLI:

```bash
gh secret set NEXT_PUBLIC_TURNSTILE_SITE_KEY --body "$(terraform output -raw turnstile_site_key)"
gh secret set TURNSTILE_SECRET_KEY --body "$(terraform output -raw turnstile_secret_key)"
```

### Step 6: Deploy

Push a `v*` tag - GitHub Actions will automatically:
- Build the site with Turnstile site key
- Deploy to Cloudflare Pages
- Deploy the API and email consumer Workers

## Infrastructure Managed by Terraform

Terraform manages:
- ✅ Cloudflare Pages project and custom domain
- ✅ Custom domain configuration
- ✅ Cloudflare Queue (contact form messages)
- ✅ Turnstile widget

GitHub Actions manages the Worker scripts, routes, queue consumer, bindings, and Pages deployments.

**Manual setup** (one-time, not managed by Terraform):
- Cloudflare Email Routing configuration

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

Then apply Terraform to retain the queue and Turnstile infrastructure, configure
the two Turnstile GitHub secrets, and push a `v*` tag.

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
2. Push a `v*` tag to deploy the updated site and Workers

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
