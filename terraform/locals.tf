locals {
  # Cloudflare credentials
  cloudflare_account_id = "311d9a01d37fdb7bcd3fdd3856aaf0a3"
  cloudflare_zone_id    = "2961ec9edffc8e797ec2ee6d39d67997"

  # GitHub repository
  repo_owner = "fbrissi"
  repo_name  = "fbrissi.dev"
  repo_id    = "R_kgDOTSroUA" # GitHub repo ID (numeric)
  owner_id   = "339706"       # GitHub owner ID (numeric)

  # Project configuration
  project_name      = "fbrissi-dev"
  production_branch = "main"
  custom_domain     = "fbrissi.dev"

  # Contact Form - Email addresses
  contact_email_to   = "f.b.rissi@gmail.com" # Verified Worker Email binding destination
  contact_email_from = "noreply@fbrissi.dev" # From address (must be @fbrissi.dev)
}
