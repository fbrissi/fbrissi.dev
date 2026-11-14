# Study group board storage. The deploy workflows resolve these databases by name, apply the
# migrations in workers/study-group/migrations, and inject the IDs into the Worker configuration.
resource "cloudflare_d1_database" "study_group" {
  account_id = local.cloudflare_account_id
  name       = "${local.project_name}-study-group"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_d1_database" "study_group_sandbox" {
  account_id = local.cloudflare_account_id
  name       = "${local.project_name}-sandbox-study-group"
}
