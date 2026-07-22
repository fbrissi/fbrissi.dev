provider "github" {
  owner = local.github_owner
}

# The public key is a repository variable because it is embedded in the static build.
resource "github_actions_variable" "turnstile_site_key" {
  repository    = local.github_repository
  variable_name = "NEXT_PUBLIC_TURNSTILE_SITE_KEY"
  value         = cloudflare_turnstile_widget.contact_form.sitekey
}

# Terraform Cloud encrypts the state; GitHub encrypts this value again at rest.
resource "github_actions_secret" "turnstile_secret_key" {
  repository  = local.github_repository
  secret_name = "TURNSTILE_SECRET_KEY"
  value       = cloudflare_turnstile_widget.contact_form.secret
}
