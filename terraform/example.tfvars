# Terraform Variables Example
# Copy this to terraform.tfvars and fill in your values

# Cloudflare credentials
cloudflare_api_token  = "your_cloudflare_api_token_here"
cloudflare_account_id = "your_cloudflare_account_id_here"
cloudflare_zone_id    = "your_cloudflare_zone_id_here"

# GitHub repository
repo_owner = "fbrissi"
repo_name  = "fbrissi.dev"
repo_id    = "your_github_repo_id_here"  # GitHub repo ID (numeric)
owner_id   = "your_github_owner_id_here" # GitHub owner ID (numeric)

# Project configuration
project_name      = "fbrissi-dev"
production_branch = "main"
custom_domain     = "fbrissi.dev"

# Contact Form - Cloudflare Turnstile
# Get keys at: https://dash.cloudflare.com/?to=/:account/turnstile
turnstile_secret_key = "your_turnstile_secret_key_here"

# Contact Form - Email addresses
contact_email_to   = "hello@fbrissi.dev"   # Where to receive form submissions
contact_email_from = "noreply@fbrissi.dev" # From address (must be @fbrissi.dev)
