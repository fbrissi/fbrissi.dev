resource "cloudflare_pages_project" "site" {
  account_id        = local.cloudflare_account_id
  name              = local.project_name
  production_branch = local.production_branch
}

resource "cloudflare_pages_project" "sandbox" {
  account_id        = local.cloudflare_account_id
  name              = "${local.project_name}-sandbox"
  production_branch = local.sandbox_branch
}

resource "cloudflare_pages_domain" "custom" {
  count        = local.custom_domain == null ? 0 : 1
  account_id   = local.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = local.custom_domain

  depends_on = [cloudflare_dns_record.site]
}

resource "cloudflare_dns_record" "site" {
  count   = local.custom_domain == null ? 0 : 1
  zone_id = local.cloudflare_zone_id
  name    = local.custom_domain
  content = cloudflare_pages_project.site.subdomain
  type    = "CNAME"
  proxied = true
  ttl     = 1

  depends_on = [cloudflare_pages_project.site]
}

resource "cloudflare_pages_domain" "sandbox" {
  account_id   = local.cloudflare_account_id
  project_name = cloudflare_pages_project.sandbox.name
  name         = local.sandbox_domain

  depends_on = [cloudflare_dns_record.sandbox]
}

resource "cloudflare_dns_record" "sandbox" {
  zone_id = local.cloudflare_zone_id
  name    = local.sandbox_domain
  content = cloudflare_pages_project.sandbox.subdomain
  type    = "CNAME"
  proxied = true
  ttl     = 1

  depends_on = [cloudflare_pages_project.sandbox]
}
