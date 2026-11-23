# Terraform

Terraform Cloud workspace `fbrissi-dev` applies this directory after a release
pull request is merged into `main`. See the root [README](../README.md) for the
manual credentials and the release flow.

## Credential permissions

Each provider authenticates with a credential created by hand, so a new
resource type can need a permission the credential lacks. The apply then fails
after merge and blocks the release.

| Provider | Credential | Permissions |
| --- | --- | --- |
| Cloudflare | API token in the GitHub secret `CLOUDFLARE_API_TOKEN`, copied to the Terraform Cloud variable `CLOUDFLARE_API_TOKEN` | [`cloudflare-token-permissions.json`](cloudflare-token-permissions.json) |
| AWS | Manually created role `fbrissi-dev-terraform`, assumed through Terraform Cloud OIDC | Root README, "AWS Access" |
| GitHub | `rissi-terraform` GitHub App | Root README, "GitHub Secrets and Variables" |

[`cloudflare-token-permissions.json`](cloudflare-token-permissions.json) is the
only list of Cloudflare permission groups the token needs. It maps every
`cloudflare_*` resource and data source type to API permission group names,
taken from the `x-api-token-group` values of the
[Cloudflare OpenAPI spec](https://github.com/cloudflare/api-schemas). The format
is documented in the shared
[`terraform-permissions`](https://github.com/fbrissi/github-actions/tree/main/actions/terraform-permissions)
action.

The `Terraform / Cloudflare token permissions` job in
`.github/workflows/quality-checks.yml` calls the shared
[`terraform-permissions`](https://github.com/fbrissi/github-actions#terraform-permissions)
reusable workflow:

- Static, on every run: fails when a `.tf` file uses a Cloudflare type missing
  from the manifest, or the manifest lists one no longer used.
- Live, on pull requests that change `terraform/` or the workflow, on pushes to
  `main`, and on manual runs: reads the token's own policies and fails with one
  error per missing permission group, naming the scope and the resource types
  that need it.

It checks the GitHub secret, so the secret and the Terraform Cloud variable
must hold the same token. Fork and Dependabot pull requests have no secrets and
get a "not checked" warning. Do not merge while it is red: the release apply
would fail the same way.

To add a permission:

1. Add the type and its groups to the manifest.
2. In the Cloudflare dashboard, edit the Terraform token and add the permission
   group with the scope shown in the check error.
3. If you rolled the token instead, update the GitHub secret and run
   `rotate-credentials.yml` in `manual` mode.
4. Re-run the failed job.

The token also needs Account API Tokens Read (granted by Account API Tokens
Write) so the live check can read its own policies.

Current Cloudflare resource types and what they need are listed in the manifest.
The R2 bucket for group icons (`r2.tf`, `cloudflare_r2_bucket`) needs **Workers
R2 Storage Write** on the account scope of the Terraform token, and R2 must be
enabled on the account first. The deployment token Terraform creates
(`credentials.tf`) also gets Workers R2 Storage Read, for deploying the study
group API Worker with its R2 binding.
