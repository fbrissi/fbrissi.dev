resource "cloudflare_pages_project" "site" {
  account_id        = local.cloudflare_account_id
  name              = local.project_name
  production_branch = local.production_branch

  build_config = {
    build_caching   = true
    build_command   = "yarn build"
    destination_dir = "out"
    root_dir        = "/"
  }

  source = {
    type = "github"
    config = {
      owner                          = local.repo_owner
      owner_id                       = local.owner_id
      pr_comments_enabled            = true
      production_branch              = local.production_branch
      production_deployments_enabled = true
      repo_id                        = local.repo_id
      repo_name                      = local.repo_name
      preview_deployment_setting     = "all"
    }
  }

  # Environment variables for production and preview builds
  deployment_configs = {
    production = {
      env_vars = {
        NEXT_PUBLIC_TURNSTILE_SITE_KEY = {
          type  = "plain_text"
          value = cloudflare_turnstile_widget.contact_form.secret
        }
      }
    }
    preview = {
      env_vars = {
        NEXT_PUBLIC_TURNSTILE_SITE_KEY = {
          type  = "plain_text"
          value = cloudflare_turnstile_widget.contact_form.secret
        }
      }
    }
  }
}

resource "cloudflare_pages_domain" "custom" {
  count        = local.custom_domain == null ? 0 : 1
  account_id   = local.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = local.custom_domain
}
