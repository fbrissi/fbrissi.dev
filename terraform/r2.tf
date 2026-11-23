# Group icons: a private R2 bucket (no public access, no r2.dev URL). Only the study group API Worker reads it, through
# its binding, and serves icons with short-lived signed URLs. It holds user uploads, so it is never destroyed by an
# apply. Cost model and guards: README, Study Groups.
resource "cloudflare_r2_bucket" "study_group_icons" {
  account_id    = local.cloudflare_account_id
  name          = "${local.project_name}-study-group-icons"
  location      = "enam"
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "study_group_icons_sandbox" {
  count         = local.sandbox_count
  account_id    = local.cloudflare_account_id
  name          = "${local.project_name}-sandbox-study-group-icons"
  location      = "enam"
  storage_class = "Standard"
}
