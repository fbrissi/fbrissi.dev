# Contact Form Setup with Terraform

This guide explains how to set up the contact form with Cloudflare using **Terraform for infrastructure as code**.

## Overview

The contact form uses:
- **Cloudflare Email Routing** (free) - forwards emails to your personal address
- **Cloudflare Workers** (free tier: 100k requests/day) - processes form submissions
- **MailChannels API** (free for Workers) - sends emails
- **Cloudflare Turnstile** (free) - anti-spam protection
- **Terraform** - manages all infrastructure

## Local Development with Mailpit

For local development, emails are sent to **Mailpit** (like Laravel's Mailpit):

- **Web UI**: http://localhost:8025
- **No configuration needed** - automatically works when you run `kool start`
- Uses Turnstile test key (always passes validation)

### Start Local Environment

```bash
# Start Docker containers (includes Mailpit)
kool start

# Open Mailpit web UI
open http://localhost:8025

# Start Next.js dev server
kool run yarn dev

# Open site
open http://localhost:3000/contact

# Test the form - emails appear in Mailpit!
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

3. **Create routing rule**:
   - **Custom address**: `hello@fbrissi.dev`
   - **Action**: Send to → your personal email
   - Save the rule

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
contact_email_to     = "hello@fbrissi.dev"
contact_email_from   = "noreply@fbrissi.dev"
```

### Step 4: Deploy with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply infrastructure
terraform apply

# Get the Turnstile site key (for GitHub secrets)
terraform output turnstile_site_key
```

### Step 5: Add Secrets to GitHub

The Turnstile site key needs to be added to GitHub Actions for builds:

```bash
# Get the site key from Terraform output
terraform output -raw turnstile_site_key

# Add to GitHub:
# Settings → Secrets and variables → Actions
# Name: NEXT_PUBLIC_TURNSTILE_SITE_KEY
# Value: <paste the output>
```

Or use GitHub CLI:

```bash
gh secret set NEXT_PUBLIC_TURNSTILE_SITE_KEY --body "$(terraform output -raw turnstile_site_key)"
```

### Step 6: Deploy

Push to main branch - GitHub Actions will automatically:
- Build the site with Turnstile site key
- Deploy to Cloudflare Pages
- Worker is already deployed by Terraform

## Infrastructure Managed by Terraform

Terraform manages:
- ✅ Cloudflare Pages project with GitHub integration
- ✅ Custom domain configuration
- ✅ Cloudflare Worker (contact form)
- ✅ Worker routes (`/api/contact`)
- ✅ Turnstile widget
- ✅ Environment variables for Pages builds

**Manual setup** (one-time, not managed by Terraform):
- Cloudflare Email Routing configuration

## Testing

### Local (Mailpit)

1. Start services: `kool start`
2. Open site: http://localhost:3000/contact
3. Fill form and submit
4. Check Mailpit: http://localhost:8025
5. Emails appear instantly with [LOCAL DEV] badge

### Production

1. Visit https://fbrissi.dev/contact
2. Fill out the form
3. Complete Turnstile captcha
4. Submit
5. Check your personal email (configured in Email Routing)

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

## Updating the Worker

Worker code is in `workers/contact-form.ts`. To update:

1. Edit the TypeScript file
2. Run `terraform apply`
3. Terraform will detect changes and redeploy

Alternatively, use Wrangler for faster iteration:

```bash
# Deploy worker directly (bypasses Terraform)
wrangler deploy

# Warning: Terraform will detect drift on next run
# Use `terraform apply` to sync state
```

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
   wrangler tail fbrissi-contact-form
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
   - Check that routing rule is active
   - Verify destination email is confirmed

2. **Check spam folder**

3. **Test MailChannels manually**:
   ```bash
   curl -X POST https://api.mailchannels.net/tx/v1/send \
     -H "Content-Type: application/json" \
     -d '{
       "personalizations": [{"to": [{"email": "your@email.com"}]}],
       "from": {"email": "test@fbrissi.dev"},
       "subject": "Test",
       "content": [{"type": "text/plain", "value": "Test"}]
     }'
   ```

### Local development issues

**Mailpit not accessible**:
```bash
# Check if container is running
docker ps | grep mailpit

# Restart services
kool restart
```

**Worker not connecting to Mailpit**:
```bash
# Check worker logs
wrangler dev

# Verify environment variable
echo $MAILPIT_URL
```

## Cost Breakdown

All services used are **free**:

- ✅ **Cloudflare Email Routing**: Free (unlimited routing rules)
- ✅ **Cloudflare Workers**: Free tier (100,000 requests/day)
- ✅ **MailChannels**: Free for Cloudflare Workers
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
   - Worker accepts requests from any origin
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
│ Cloudflare      │
│ Worker          │◄───── Terraform manages
│ (contact-form)  │
└────────┬────────┘
         │
         ├─────────────┐
         │             │
         ▼             ▼
┌──────────────┐  ┌──────────────┐
│  Turnstile   │  │ MailChannels │
│  Validation  │  │   (prod)     │
└──────────────┘  │     or       │
                  │  Mailpit     │
                  │   (local)    │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Email Routing│◄─── Manual setup
                  │  (Cloudflare)│
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Your Personal│
                  │    Email     │
                  └──────────────┘
```

## References

- [Cloudflare Terraform Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [Cloudflare Email Routing Docs](https://developers.cloudflare.com/email-routing/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/)
- [MailChannels API Docs](https://api.mailchannels.net/tx/v1/documentation)
- [Mailpit](https://github.com/axllent/mailpit)

---

**Setup completed!** Infrastructure managed via Terraform, local development with Mailpit, zero monthly costs.
