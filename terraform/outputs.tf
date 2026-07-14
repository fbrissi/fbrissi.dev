# Outputs for reference
output "pages_project_subdomain" {
  description = "Cloudflare Pages project subdomain"
  value       = "${cloudflare_pages_project.site.subdomain}.pages.dev"
}

output "pages_project_domains" {
  description = "All domains associated with the Pages project"
  value       = cloudflare_pages_project.site.domains
}

output "custom_domain" {
  description = "Custom domain (if configured)"
  value       = local.custom_domain
}

output "contact_api_worker_script_name" {
  description = "Contact form API Worker script name"
  value       = cloudflare_workers_script.contact_api.script_name
}

output "contact_email_consumer_worker_script_name" {
  description = "Contact email consumer Worker script name"
  value       = cloudflare_workers_script.contact_email_consumer.script_name
}

output "contact_form_queue_name" {
  description = "Contact form queue name"
  value       = cloudflare_queue.contact_form.queue_name
}

output "turnstile_site_key" {
  description = "Turnstile site key (public)"
  value       = cloudflare_turnstile_widget.contact_form.secret
  sensitive   = true
}

output "contact_form_api_url" {
  description = "Contact form API endpoint"
  value       = "https://${local.custom_domain}/api/contact"
}
