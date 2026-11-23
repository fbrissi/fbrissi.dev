locals {
  # Cloudflare credentials
  cloudflare_account_id = "311d9a01d37fdb7bcd3fdd3856aaf0a3"
  cloudflare_zone_id    = "2961ec9edffc8e797ec2ee6d39d67997"

  # Project configuration
  project_name      = "fbrissi-dev"
  production_branch = "main"
  sandbox_branch    = "sandbox"
  custom_domain     = "fbrissi.dev"
  sandbox_domain    = "sandbox.fbrissi.dev"

  # The sandbox environment (sandbox.fbrissi.dev) is off. Every sandbox resource below uses
  # `count = local.sandbox_enabled ? 1 : 0`, so turning it off destroys them on the next apply, and turning it on
  # creates them again (with an empty sandbox D1). The Worker `[env.sandbox]` blocks and .github/workflows/sandbox.yml
  # (gated by the SANDBOX_ENABLED repository variable) stay as the reference for how the sandbox is built.
  sandbox_enabled   = false
  sandbox_count     = local.sandbox_enabled ? 1 : 0
  github_owner      = "fbrissi"
  github_repository = "fbrissi.dev"

  # Contact Form - Email addresses
  contact_email_to     = "f.b.rissi@gmail.com"  # Verified Worker Email binding destination
  contact_email_from   = "no-reply@fbrissi.dev" # From address (must be @fbrissi.dev)
  public_contact_email = "contact@fbrissi.dev"
  # Alias kept so Portuguese-style typos still reach the inbox
  public_contact_email_aliases = ["contato@fbrissi.dev"]

  # The English study groups program's own address (Reply-To of its notifications, abuse reports, program questions and
  # its personal-data requests), forwarded to the same verified inbox. Keep it in sync with STUDY_GROUPS_EMAIL in
  # workers/study-group/contract.ts.
  study_groups_email = "groups@fbrissi.dev"

  # Study group notifications are sent by SES from this address (workers/study-group/ses.ts).
  notifications_email_from = "notifications@fbrissi.dev"

  # AWS account shared with the Oliblish projects; Terraform only reaches the fbrissi.dev SES identity.
  aws_account_id = "526983805816"
  aws_region     = "us-east-1"
  aws_tags = {
    Project    = local.project_name
    Repository = "${local.github_owner}/${local.github_repository}"
    ManagedBy  = "terraform"
  }
}
