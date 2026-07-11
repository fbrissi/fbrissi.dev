variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare Zone ID for the domain (required for Worker routes)"
}

variable "project_name" {
  type    = string
  default = "fbrissi-dev"
}

variable "production_branch" {
  type    = string
  default = "main"
}

variable "repo_owner" {
  type = string
}

variable "repo_name" {
  type    = string
  default = "fbrissi.dev"
}

variable "repo_id" {
  type = string
}

variable "owner_id" {
  type = string
}

variable "custom_domain" {
  type    = string
  default = null
}

# Contact Form Variables
variable "turnstile_secret_key" {
  type        = string
  sensitive   = true
  description = "Cloudflare Turnstile secret key for contact form"
}

variable "contact_email_to" {
  type        = string
  description = "Email address to receive contact form submissions (e.g., hello@fbrissi.dev)"
}

variable "contact_email_from" {
  type        = string
  description = "From email address for contact form (e.g., noreply@fbrissi.dev)"
}
