data "cloudflare_account_api_token_permission_groups_list" "all" {
  account_id = local.cloudflare_account_id
}

locals {
  # Permission group names repeat across scopes, so groups are indexed per scope.
  account_permission_group_ids = {
    for group in data.cloudflare_account_api_token_permission_groups_list.all.result :
    group.name => group.id if contains(group.scopes, "com.cloudflare.api.account")
  }
  zone_permission_group_ids = {
    for group in data.cloudflare_account_api_token_permission_groups_list.all.result :
    group.name => group.id if contains(group.scopes, "com.cloudflare.api.account.zone")
  }
  deploy_account_permissions = ["Account Settings Read", "D1 Write", "Pages Write", "Queues Write", "Workers Scripts Write"]
  deploy_zone_permissions    = ["Workers Routes Write", "Zone Read"]
}

# Deployment token used by the production and sandbox GitHub Actions deploys. Rotated by replacing this resource
# (.github/workflows/rotate-credentials.yml); the old token is revoked on apply.
resource "cloudflare_account_token" "deploy" {
  account_id = local.cloudflare_account_id
  name       = "${local.github_repository} GitHub Actions deploy"

  policies = [
    {
      effect            = "allow"
      permission_groups = [for name in local.deploy_account_permissions : { id = local.account_permission_group_ids[name] }]
      resources         = jsonencode({ "com.cloudflare.api.account.${local.cloudflare_account_id}" = "*" })
    },
    {
      effect            = "allow"
      permission_groups = [for name in local.deploy_zone_permissions : { id = local.zone_permission_group_ids[name] }]
      resources         = jsonencode({ "com.cloudflare.api.account.zone.${local.cloudflare_zone_id}" = "*" })
    },
  ]

  lifecycle {
    create_before_destroy = true
  }
}
