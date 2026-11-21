# Outputs for reference
output "pages_project_subdomain" {
  description = "Cloudflare Pages project subdomain"
  value       = cloudflare_pages_project.site.subdomain
}

output "pages_project_domains" {
  description = "All domains associated with the Pages project"
  value       = cloudflare_pages_project.site.domains
}

output "custom_domain" {
  description = "Custom domain (if configured)"
  value       = local.custom_domain
}

output "contact_form_queue_name" {
  description = "Contact form queue name"
  value       = cloudflare_queue.contact_form.queue_name
}

output "turnstile_site_key" {
  description = "Turnstile site key (public)"
  value       = cloudflare_turnstile_widget.contact_form.sitekey
}

output "turnstile_secret_key" {
  description = "Turnstile secret key"
  value       = cloudflare_turnstile_widget.contact_form.secret
  sensitive   = true
}

output "contact_form_api_url" {
  description = "Contact form API endpoint"
  value       = "https://${local.custom_domain}/api/contact"
}

# Gmail and Spark "Send mail as" settings: server email-smtp.us-east-1.amazonaws.com, port 587 (TLS).
output "gmail_smtp_username" {
  description = "SES SMTP username for fbrissi.dev"
  value       = aws_iam_access_key.gmail_smtp.id
}

output "gmail_smtp_password" {
  description = "SES SMTP password for fbrissi.dev"
  value       = aws_iam_access_key.gmail_smtp.ses_smtp_password_v4
  sensitive   = true
}

output "study_group_database_id" {
  description = "Study group D1 database ID"
  value       = cloudflare_d1_database.study_group.id
}

output "study_group_sandbox_database_id" {
  description = "Sandbox study group D1 database ID"
  value       = cloudflare_d1_database.study_group_sandbox.id
}
