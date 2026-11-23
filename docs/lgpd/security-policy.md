# Simplified information security policy

Internal document, not published on the site. Essential security measures for a small-scale processing agent
(CD/ANPD Resolution 2/2022, arts. 12 and 13; LGPD art. 46). Keep it consistent with the code and the published
Privacy Policy, section 10.

## Scope

The site `fbrissi.dev`, the contact form, the English study groups program and the Workers, D1 databases, R2 bucket,
queues and SES identity behind them. One person runs everything: Filipe Bojikian Rissi.

## Measures in place

- **Access control:**
  - Cloudflare, AWS, Google Cloud and GitHub accounts use strong passwords and two-factor authentication.
  - Deploys use a scoped Cloudflare token created by Terraform (`terraform/credentials.tf`), rotated twice a year by
    `rotate-credentials.yml`.
  - AWS access is through Terraform Cloud OIDC to the `fbrissi-dev-terraform` role. The SES sending key can only call
    `ses:SendEmail` from notifications@fbrissi.dev.
  - Secrets live only in GitHub Actions secrets, Terraform Cloud and the Worker secrets; never in the repository.
- **Application:**
  - HTTPS everywhere (HSTS); a strict Content-Security-Policy; `__Host-` session cookies that are HttpOnly, Secure and
    SameSite. Only a SHA-256 hash of the session token is stored.
  - Every API route checks the caller's role. State-changing requests need an allowed Origin and a JSON (or, for icon
    uploads, image) body; only the one-click unsubscribe is exempt, and its signed token is the credential.
  - Rate limits on reads, writes, sign-in, joins and icon uploads; Turnstile on the contact form.
  - Uploaded icons are checked by content and stored without metadata in a private bucket, served only through
    signed links that expire within 2 hours.
  - Email addresses are never shown to other users, put in queues or logged.
- **Data minimisation and retention:** only the data listed in the Privacy Policy is collected; deletions are
  permanent and immediate; the daily cron purges expired data (see the policy, section 7).
- **Backups and recovery:** D1 Time Travel (7 days on the Free plan); a manual export before each release that changes
  the schema (README release runbook).
- **Dependencies:** Dependabot updates, a high-severity audit in CI, and the safe-node-package checks before adding a
  dependency.
- **Logs:** Cloudflare Workers Logs (up to 7 days); logs carry IDs, never email addresses.

## Incidents

If an incident may cause relevant risk or damage to data subjects, notify the ANPD and the affected people (CD/ANPD
Resolution 15/2024). As an ATPP, the deadline is doubled (Res. 2/2022, art. 14). Steps:

1. Contain: revoke or rotate the affected credentials, disable the affected Worker or route.
2. Assess: which data, how many people, the likely consequences.
3. Notify the ANPD and the people affected, in plain language, through the official ANPD form and email.
4. Record the incident and the decisions taken, and keep the record for at least 5 years.

## Review

Review this policy with every release that changes data flows or providers, and at least once a year. Last reviewed:
2026-11-22.
