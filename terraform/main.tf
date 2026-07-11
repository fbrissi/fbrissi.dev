resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config = {
    build_caching   = true
    build_command   = "yarn build"
    destination_dir = "out"
    root_dir        = "/"
  }

  source = {
    type = "github"
    config = {
      owner                          = var.repo_owner
      owner_id                       = var.owner_id
      pr_comments_enabled            = true
      production_branch              = var.production_branch
      production_deployments_enabled = true
      repo_id                        = var.repo_id
      repo_name                      = var.repo_name
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
  count        = var.custom_domain == null ? 0 : 1
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = var.custom_domain
}
