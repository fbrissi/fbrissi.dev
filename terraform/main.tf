resource "cloudflare_pages_project" "site" {
  account_id        = local.cloudflare_account_id
  name              = local.project_name
  production_branch = local.production_branch
}

resource "cloudflare_pages_domain" "custom" {
  count        = local.custom_domain == null ? 0 : 1
  account_id   = local.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = local.custom_domain
}
