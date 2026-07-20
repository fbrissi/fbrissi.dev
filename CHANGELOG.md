# Changelog

All notable changes to this project are documented here. Release versions follow
[Semantic Versioning](https://semver.org/).

## v0.1.4

### Fixed

- Remove unnecessary `.pages.dev` suffix in outputs and DNS records

## v0.1.3

### Fixed

- Extended the Terraform Cloud apply wait window for release workflows.

## v0.1.2

### Fixed

- Published tagged Cloudflare Pages releases as production deployments.

## v0.1.1

### Fixed

- Disabled the public `workers.dev` route for the queue-only contact email consumer.
- Added the missing proxied DNS record for the Pages custom domain.

## v0.1.0

### Added

- Initial public release of the bilingual portfolio in English and Brazilian Portuguese.
- Localized home, about, articles, projects, works, and contact routes.
- Markdown-backed article, project, and work collections with localized profile data.
- Responsive navigation, language switching, metadata, sitemap, robots, and structured data.
- Protected contact form using Turnstile, Cloudflare Workers, and asynchronous queue-based email delivery.
- Local contact-flow development with Docker, LocalStack, and Mailpit.
- Terraform configuration for Cloudflare Pages, the contact queue, Turnstile, and GitHub integration.
- GitHub Actions workflows for quality checks, release-note validation, semantic-versioned releases, and deployment.
