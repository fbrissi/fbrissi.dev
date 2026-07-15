terraform {
  required_version = ">= 1.7.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  cloud {
    hostname     = "app.terraform.io"
    organization = "fbrissi"

    workspaces {
      name = "fbrissi-dev"
    }
  }
}
