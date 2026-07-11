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
  value       = var.custom_domain
}

output "worker_script_name" {
  description = "Contact form Worker script name"
  value       = cloudflare_workers_script.contact_form.script_name
}

output "turnstile_site_key" {
  description = "Turnstile site key (public)"
  value       = cloudflare_turnstile_widget.contact_form.secret
  sensitive   = true
}

output "contact_form_api_url" {
  description = "Contact form API endpoint"
  value       = "https://${var.custom_domain}/api/contact"
}
