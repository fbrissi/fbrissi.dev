# Contact form API Worker. It validates submissions and writes valid messages to
# the queue, keeping the browser request independent from email delivery.
resource "cloudflare_workers_script" "contact_api" {
  account_id  = local.cloudflare_account_id
  script_name = "${local.project_name}-contact-api"
  content     = file("${path.module}/../dist/contact-api.js")

  bindings = [
    {
      name = "ENVIRONMENT"
      text = "production"
      type = "plain_text"
    },
    {
      name = "TURNSTILE_SECRET_KEY"
      text = cloudflare_turnstile_widget.contact_form.secret
      type = "plain_text"
    },
    {
      name       = "CONTACT_FORM_QUEUE"
      queue_name = cloudflare_queue.contact_form.queue_name
      type       = "queue"
    }
  ]
}

# Queue consumed asynchronously by the email delivery Worker.
resource "cloudflare_queue" "contact_form" {
  account_id = local.cloudflare_account_id
  queue_name = "${local.project_name}-contact-form"
}

# Email delivery Worker. It has no HTTP route and is invoked only by the queue.
resource "cloudflare_workers_script" "contact_email_consumer" {
  account_id  = local.cloudflare_account_id
  script_name = "${local.project_name}-contact-email-consumer"
  content     = file("${path.module}/../dist/contact-email-consumer.js")

  bindings = [
    {
      name = "CONTACT_EMAIL_TO"
      text = local.contact_email_to
      type = "plain_text"
    },
    {
      name = "CONTACT_EMAIL_FROM"
      text = local.contact_email_from
      type = "plain_text"
    },
    {
      name                = "SEND_EMAIL"
      destination_address = local.contact_email_to
      type                = "send_email"
    }
  ]
}

resource "cloudflare_queue_consumer" "contact_email" {
  account_id  = local.cloudflare_account_id
  queue_id    = cloudflare_queue.contact_form.queue_id
  script_name = cloudflare_workers_script.contact_email_consumer.script_name
  type        = "worker"

  settings = {
    batch_size       = 10
    max_retries      = 3
    max_wait_time_ms = 5000
    retry_delay      = 30
  }
}

# Worker routes for contact form API.
resource "cloudflare_workers_route" "contact_form_apex" {
  zone_id = local.cloudflare_zone_id
  pattern = "${local.custom_domain}/api/contact"
  script  = cloudflare_workers_script.contact_api.id
}

resource "cloudflare_workers_route" "contact_form_www" {
  zone_id = local.cloudflare_zone_id
  pattern = "www.${local.custom_domain}/api/contact"
  script  = cloudflare_workers_script.contact_api.id
}

# Turnstile Widget (anti-spam)
resource "cloudflare_turnstile_widget" "contact_form" {
  account_id = local.cloudflare_account_id
  name       = "${local.project_name}-contact-form"
  domains    = [local.custom_domain, "www.${local.custom_domain}"]
  mode       = "managed"
}
