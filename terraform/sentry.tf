# Error monitoring in the oliblish Sentry organization, shared with nota-profile (same plan and event quota). One
# project for the whole site: the Workers tag their events with `worker`, the browser with `runtime`. The DSN is
# public (it only accepts events), so the Deploy workflow reads it from a repository variable.
locals {
  sentry_organization = "oliblish"
}

resource "sentry_team" "fbrissi_dev" {
  organization = local.sentry_organization
  name         = "fbrissi.dev"
  slug         = "fbrissi-dev"
}

resource "sentry_project" "fbrissi_dev" {
  organization = local.sentry_organization
  teams        = [sentry_team.fbrissi_dev.slug]
  name         = "fbrissi-dev"
  slug         = "fbrissi-dev"
  platform     = "javascript"
  default_key  = false

  # Server-side guards behind the SDK policy (workers/observability/sentry-policy.ts): no IP address is stored, and
  # Sentry's default scrubbers (passwords, tokens, credit cards and similar) run on every event. The Privacy Policy
  # says the IP address is not stored.
  scrub_ip_addresses     = true
  data_scrubber          = true
  data_scrubber_defaults = true
}

resource "sentry_key" "production" {
  organization = local.sentry_organization
  project      = sentry_project.fbrissi_dev.slug
  name         = "production"
}

resource "github_actions_variable" "sentry_dsn" {
  repository    = local.github_repository
  variable_name = "SENTRY_DSN"
  value         = nonsensitive(sentry_key.production.dsn["public"])
}
