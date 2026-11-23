# The public key is a repository variable because it is embedded in the static build.
resource "github_actions_variable" "turnstile_site_key" {
  repository    = local.github_repository
  variable_name = "NEXT_PUBLIC_TURNSTILE_SITE_KEY"
  value         = cloudflare_turnstile_widget.contact_form.sitekey
}

resource "github_actions_variable" "turnstile_site_key_legacy" {
  repository    = local.github_repository
  variable_name = "VITE_TURNSTILE_SITE_KEY"
  value         = cloudflare_turnstile_widget.contact_form.sitekey
}

# Terraform Cloud encrypts the state; GitHub encrypts this value again at rest.
resource "github_actions_secret" "turnstile_secret_key" {
  repository  = local.github_repository
  secret_name = "TURNSTILE_SECRET_KEY"
  value       = cloudflare_turnstile_widget.contact_form.secret
}

resource "github_actions_secret" "cloudflare_deploy_api_token" {
  repository  = local.github_repository
  secret_name = "CLOUDFLARE_DEPLOY_API_TOKEN"
  value       = cloudflare_account_token.deploy.value
}

# SES keys of the study group mailer Workers, pushed to them by the Deploy and Deploy Sandbox workflows.
resource "github_actions_secret" "study_group_ses_access_key_id" {
  repository  = local.github_repository
  secret_name = "STUDY_GROUP_SES_ACCESS_KEY_ID"
  value       = aws_iam_access_key.study_group_mailer.id
}

resource "github_actions_secret" "study_group_ses_secret_access_key" {
  repository  = local.github_repository
  secret_name = "STUDY_GROUP_SES_SECRET_ACCESS_KEY"
  value       = aws_iam_access_key.study_group_mailer.secret
}

resource "github_actions_secret" "study_group_sandbox_ses_access_key_id" {
  count       = local.sandbox_count
  repository  = local.github_repository
  secret_name = "STUDY_GROUP_SANDBOX_SES_ACCESS_KEY_ID"
  value       = aws_iam_access_key.study_group_mailer_sandbox[0].id
}

resource "github_actions_secret" "study_group_sandbox_ses_secret_access_key" {
  count       = local.sandbox_count
  repository  = local.github_repository
  secret_name = "STUDY_GROUP_SANDBOX_SES_SECRET_ACCESS_KEY"
  value       = aws_iam_access_key.study_group_mailer_sandbox[0].secret
}

# Study group API Worker secrets, pushed to it by the Deploy and Deploy Sandbox workflows.
resource "github_actions_secret" "google_oauth_client_id" {
  repository  = local.github_repository
  secret_name = "GOOGLE_OAUTH_CLIENT_ID"
  value       = var.GOOGLE_OAUTH_CLIENT_ID
}

resource "github_actions_secret" "google_oauth_client_secret" {
  repository  = local.github_repository
  secret_name = "GOOGLE_OAUTH_CLIENT_SECRET"
  value       = var.GOOGLE_OAUTH_CLIENT_SECRET
}

resource "github_actions_secret" "study_group_platform_admin_emails" {
  repository  = local.github_repository
  secret_name = "STUDY_GROUP_PLATFORM_ADMIN_EMAILS"
  value       = var.STUDY_GROUP_PLATFORM_ADMIN_EMAILS
}

# Signs the one-click unsubscribe links in notification emails. Generated once and not rotated: the links in emails
# already sent stay valid for a year, and a new value would break them.
resource "random_password" "study_group_unsubscribe_secret" {
  length  = 64
  special = false
}

resource "github_actions_secret" "study_group_unsubscribe_secret" {
  repository  = local.github_repository
  secret_name = "STUDY_GROUP_UNSUBSCRIBE_SECRET"
  value       = random_password.study_group_unsubscribe_secret.result
}
