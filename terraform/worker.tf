# Contact Form Worker
# Note: Run `yarn build:worker` before applying to compile TypeScript to JavaScript
resource "cloudflare_workers_script" "contact_form" {
  account_id  = var.cloudflare_account_id
  script_name = "${var.project_name}-contact-form"
  content     = file("${path.module}/../dist/contact-form.js")

  bindings = [
    {
      name = "ENVIRONMENT"
      text = "production"
      type = "plain_text"
    },
    {
      name = "TURNSTILE_SECRET_KEY"
      text = var.turnstile_secret_key
      type = "plain_text"
    },
    {
      name = "CONTACT_EMAIL_TO"
      text = var.contact_email_to
      type = "plain_text"
    },
    {
      name = "CONTACT_EMAIL_FROM"
      text = var.contact_email_from
      type = "plain_text"
    }
  ]
}

# Worker Routes for contact form API
resource "cloudflare_workers_route" "contact_form_apex" {
  zone_id = var.cloudflare_zone_id
  pattern = "${var.custom_domain}/api/contact"
  script  = cloudflare_workers_script.contact_form.id
}

resource "cloudflare_workers_route" "contact_form_www" {
  zone_id = var.cloudflare_zone_id
  pattern = "www.${var.custom_domain}/api/contact"
  script  = cloudflare_workers_script.contact_form.id
}

# Turnstile Widget (anti-spam)
resource "cloudflare_turnstile_widget" "contact_form" {
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-contact-form"
  domains    = [var.custom_domain, "www.${var.custom_domain}"]
  mode       = "managed"
}
