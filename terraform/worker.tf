# Queue consumed asynchronously by the email delivery Worker.
resource "cloudflare_queue" "contact_form" {
  account_id = local.cloudflare_account_id
  queue_name = "${local.project_name}-contact-form"
}

resource "cloudflare_queue" "contact_form_sandbox" {
  account_id = local.cloudflare_account_id
  queue_name = "${local.project_name}-sandbox-contact-form"
}

# Turnstile Widget (anti-spam)
resource "cloudflare_turnstile_widget" "contact_form" {
  account_id = local.cloudflare_account_id
  name       = "${local.project_name}-contact-form"
  domains    = [local.custom_domain, "www.${local.custom_domain}", local.sandbox_domain]
  mode       = "managed"
}

# Public contact address forwarded through Cloudflare Email Routing.
resource "cloudflare_email_routing_rule" "public_contact" {
  zone_id = local.cloudflare_zone_id
  name    = "Forward ${local.public_contact_email} to the verified contact inbox"
  enabled = true

  matchers = [{
    type  = "literal"
    field = "to"
    value = local.public_contact_email
  }]

  actions = [{
    type  = "forward"
    value = [local.contact_email_to]
  }]
}

# Alias addresses (e.g. contato@) forward to the same verified inbox.
resource "cloudflare_email_routing_rule" "public_contact_alias" {
  for_each = toset(local.public_contact_email_aliases)

  zone_id = local.cloudflare_zone_id
  name    = "Forward ${each.value} to the verified contact inbox"
  enabled = true

  matchers = [{
    type  = "literal"
    field = "to"
    value = each.value
  }]

  actions = [{
    type  = "forward"
    value = [local.contact_email_to]
  }]
}

# Monitor authentication failures for messages sent from the domain.
resource "cloudflare_dns_record" "dmarc" {
  zone_id = local.cloudflare_zone_id
  name    = "_dmarc"
  type    = "TXT"
  content = "\"v=DMARC1; p=none; rua=mailto:${local.contact_email_to}\""
  ttl     = 1
}
