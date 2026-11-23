variable "CLOUDFLARE_API_TOKEN" {
  type      = string
  sensitive = true
}

variable "GITHUB_APP_ID" {
  type = string
}

variable "GITHUB_APP_INSTALLATION_ID" {
  type = string
}

variable "GITHUB_APP_PEM_FILE" {
  type      = string
  sensitive = true
}

# Google OAuth client of the study groups sign-in. Google has no API to create a Web application OAuth client, so it
# is created by hand in Google Cloud Console and its values are set here as Terraform Cloud workspace variables.
variable "GOOGLE_OAUTH_CLIENT_ID" {
  type = string
}

variable "GOOGLE_OAUTH_CLIENT_SECRET" {
  type      = string
  sensitive = true
}

# Comma-separated emails of the study groups platform admins (Google accounts). Sensitive so they stay out of the
# public repository and the plan output.
variable "STUDY_GROUP_PLATFORM_ADMIN_EMAILS" {
  type      = string
  sensitive = true
}
