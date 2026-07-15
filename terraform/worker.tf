# Queue consumed asynchronously by the email delivery Worker.
resource "cloudflare_queue" "contact_form" {
  account_id = local.cloudflare_account_id
  queue_name = "${local.project_name}-contact-form"
}

# Turnstile Widget (anti-spam)
resource "cloudflare_turnstile_widget" "contact_form" {
  account_id = local.cloudflare_account_id
  name       = "${local.project_name}-contact-form"
  domains    = [local.custom_domain, "www.${local.custom_domain}"]
  mode       = "managed"
}
