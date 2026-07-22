locals {
  # Cloudflare credentials
  cloudflare_account_id = "311d9a01d37fdb7bcd3fdd3856aaf0a3"
  cloudflare_zone_id    = "2961ec9edffc8e797ec2ee6d39d67997"

  # Project configuration
  project_name      = "fbrissi-dev"
  production_branch = "main"
  custom_domain     = "fbrissi.dev"
  sandbox_domain    = "sandbox.fbrissi.dev"
  github_owner      = "fbrissi"
  github_repository = "fbrissi.dev"

  # Contact Form - Email addresses
  contact_email_to     = "f.b.rissi@gmail.com"  # Verified Worker Email binding destination
  contact_email_from   = "no-reply@fbrissi.dev" # From address (must be @fbrissi.dev)
  public_contact_email = "contact@fbrissi.dev"
  # Alias kept so Portuguese-style typos still reach the inbox
  public_contact_email_aliases = ["contato@fbrissi.dev"]
}
