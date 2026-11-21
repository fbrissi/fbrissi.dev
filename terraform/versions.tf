terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
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

# Credentials come from Terraform Cloud dynamic provider credentials (TFC_AWS_PROVIDER_AUTH and TFC_AWS_RUN_ROLE_ARN
# workspace variables) for the manually created fbrissi-dev-terraform role; no AWS key is stored. See README "AWS Access".
provider "aws" {
  region              = local.aws_region
  allowed_account_ids = [local.aws_account_id]

  default_tags {
    tags = local.aws_tags
  }
}

provider "cloudflare" {
  api_token = var.CLOUDFLARE_API_TOKEN
}

provider "github" {
  owner = local.github_owner

  app_auth {
    id              = var.GITHUB_APP_ID
    installation_id = var.GITHUB_APP_INSTALLATION_ID
    pem_file        = var.GITHUB_APP_PEM_FILE
  }
}
