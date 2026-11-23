# Changelog

All notable changes to this project are documented here. Release versions follow
[Semantic Versioning](https://semver.org/).

## v0.4.1

### Fixed

- Unblock the v0.4.0 release, which stopped at the Terraform Cloud apply: Cloudflare refused to delete the sandbox contact queues because the production contact Workers deployed before this release still bind them. The two sandbox contact queues stay for this release, and the Deploy workflow removes the production email Worker's consumer from the sandbox queue before deploying the contact Workers, which drops the producer binding. A later release deletes the queues. The v0.4.0 tag was never created, so this release ships everything listed under v0.4.0.

## v0.4.0

### Added

- Turn the DevTalk board into the English study groups program: a public, indexed landing page with the listed groups (name and summary only), and versioned Terms of Use (with the content policy) and Privacy Policy, in English and Portuguese, with an informational cookie notice.
- Add Google sign-in to the study group Worker (Authorization Code with PKCE S256, state and nonce, RS256 ID token verification against Google's cached JWKS), with explicit acceptance of the Terms and Privacy Policy and an 18+ confirmation before an account exists, re-acceptance only for material changes, and only of the document that changed (`MATERIAL_POLICY_VERSIONS`; minor edits take effect on publication), 30-day `__Host-` sessions stored as SHA-256 hashes, and CSRF Origin and JSON checks.
- Let signed-in users create up to 3 groups and ask to join others with the group's access code; the owner approves requests, runs draws and votes, deletes content, chooses free or reviewed suggestions, rotates the code, removes members and deletes the group. Every deletion is permanent and immediate (no soft delete, no restore), and every delete in the UI says so and names what goes with it.
- Add the platform admin (`STUDY_GROUP_PLATFORM_ADMIN_EMAILS`): manages every group (in groups they don't belong to, they don't suggest or vote), deletions with a mandatory 10 to 500 character reason, an audit log of deletions and bans, and in-app notices to owners that outlive the deleted group.
- Add account pages to edit the display name, download a JSON export of the account data, and delete the account (owned groups are deleted, other contributions stay as "Former member").
- Add a daily Cron Trigger that purges decided join requests after 30 days, the moderation log after 12 months, and expired sessions, and a join-with-code rate limiter.
- Add group icons on the app pages (board, settings, My groups, join screen; never the public list): PNG, JPEG or WebP up to 256 KB and 512 × 512 pixels, checked by content, stored without EXIF/XMP/IPTC/text metadata (in JPEG, also between progressive scans and after the end of the image) in a private Terraform-managed R2 bucket (`fbrissi-dev-study-group-icons`), and served through hourly HMAC-signed URLs from the API Worker with edge caching. Uploads are rate limited and capped per user and group, replaced or deleted objects go at once and their still-valid signed URLs are purged from the edge cache, a daily cron removes orphans, account and group deletion remove the icons, and the data export includes them. The platform admin can remove an icon with a reason (log, owner notice and email).
- Add account bans for the platform admin: search users (emails never shown), ban, renew and unban with a logged reason, asked in an in-page dialog with inline validation. A ban lasts at most 2 years unless renewed (the daily cron deletes expired ban records). A ban ends the sessions, emails the user once with the reason and how to contest it (even with service emails off; lifting it sends an "account restored" email the same way), deletes their groups permanently (with an email each), hides their content, and refuses sign-in and sign-up for the same Google account or email.
- Remove soft delete and the admin restore: migration `0004_hard_delete.sql` deletes the rows earlier versions only marked as deleted and keeps each log entry's group owner; migration `0005_icons_and_bans.sql` adds the icon columns, upload counters and bans.
- Add a local fake Google IdP to the Docker stack for local sign-in and E2E tests.
- Specify the E2E suite as Gherkin stories in `e2e/features/` (every feature, role and permission, signed-out and forged-cookie API access, and the emails): each scenario is a Playwright test with the same title, and `yarn e2e:features` fails when a scenario has no test or a test has no scenario. New specs cover the role × route table, CSRF and content types, email exposure, icon checks and signed links, caps, round rules, ban renewal, email format and opt-out, the portfolio SEO and the contact email. A new `Quality / e2e` job runs the whole suite on every non-draft pull request (not on pushes; images are pulled fresh) against the Docker stack (`docker-compose.ci.yml`, no secrets), uploads the Playwright report and traces when it fails, and gates Quality Checks (skipped outside pull requests).
- Add English-only study group emails through Amazon SES, from `notifications@fbrissi.dev` with Reply-To `contact@fbrissi.dev`: a digest to the owner when join requests wait (at most one per group every 6 hours: one right away, then one trailing digest at the end of the window for requests still pending; with the count and no requester name or message; the unclaimed DevTalk group gets one when the admin claims it), the decision to the requester (the rejection mentions the 7-day wait), and the admin deletion of a group, with the reason, to its owner. Routes write an outbox row (`0003_notifications.sql`) in the same D1 batch and queue only its ID; a separate mailer Worker (`fbrissi-dev-study-group-mailer`), the only holder of the SES key, claims each row before sending, sends with a hand-written SigV4 over WebCrypto, caps sends per recipient and per day, retries with backoff and marks a row failed after the 6th attempt; the daily cron re-drives idle rows, logs failure counts and purges the outbox after 30 days. Terraform adds the notification queues, a `fbrissi-dev-study-group-mailer` IAM user that can only call `ses:SendEmail` from `notifications@fbrissi.dev`, and its key as GitHub secrets, which `rotate-credentials.yml` replaces in automatic mode.
- Add an email on/off setting to the account page (the data export includes it and every email record, with the group name and any admin reason) and a one-click unsubscribe link in every email (`List-Unsubscribe` and `List-Unsubscribe-Post`, signed with the new `STUDY_GROUP_UNSUBSCRIBE_SECRET`, with a `/study-groups/unsubscribe` confirmation page); only that route skips the CSRF check. Group names can no longer contain links or web addresses. The local stack sends the emails to Mailpit.
- Add the Nota Profile, English Study Groups, ai-skills and github-actions projects in English and Portuguese, and feature Nota Profile on the home page with a sign-up link tagged with UTM parameters. fbrissi.dev moves to the end of the project list.
- Show a short notice under the contact form and next to the address on `/contact` that messages are processed by the providers listed in the Privacy Policy, some outside Brazil, and point the contact form's error state to the form instead of `mailto:`. The home call to action becomes "Contact me" / "Fale comigo" and links to the contact form (`/contact`, `/pt-br/contact`) instead of `mailto:`. Keep a short internal record of processing and security policy in `docs/lgpd/` (not published).
- Add a site-wide Privacy Policy at `/privacy` and `/pt-br/privacy` that covers the contact form and emails sent directly to contact@ or contato@ (Cloudflare, with Email Routing, and Google as processors, Turnstile's browser and device signals, 12 months in the mailbox, up to 24 hours in the dead-letter queue (the fixed Cloudflare Queues retention on the Free plan), the IP address sent to Turnstile verification, up to 7 days of Cloudflare Workers Logs, and Amazon SES for replies sent as contact@, including any quoted text) and the study groups program, including the service emails (Amazon SES as a provider, performance of the Terms as the legal basis, the opt-out, and 30 days for the outbox and send log), and a plain international transfer section (Cloudflare, Google and Amazon Web Services, some outside Brazil, under their contractual commitments and the safeguards allowed by LGPD art. 33) (version `2026-11-22`, so members accept it again at their next visit). The Terms of Use (version `2026-11-22`) mention the service emails and how to turn them off, ban offensive images, political content and any offensive subject (removed, and the account may be banned), and describe bans; the Privacy Policy covers group icons (R2, metadata stripped, retention), ban records (at most 2 years) and permanent deletion (with up to 7 days in D1 Time Travel). The contact form, the footer and the study groups pages link to it; `/study-groups/privacy` redirects there with a 301.
- Add a skip link, `aria-current` on the navigation (`page` for the current page, `true` for its section), a global focus ring, a keyboard-operable resume menu that lists the page's language first and returns focus to its button, and a mobile menu with 44px rows (Escape returns focus to its button) that replaces the four-row wrapped navigation.
- Add `ProfilePage` structured data to About and one full `Person` node (stable `@id`) reused by home, About and the article author, `WebPage` and `BreadcrumbList` markup on the detail pages, `SoftwareSourceCode` for projects with a GitHub repository, and a raster social image with publish dates for the article.
- Add languages and credentials (MBA, IGTI, 2017–2018) to About, four linked proof points (including the Kool Dev Java and Spring Boot presets, kool-dev/kool#542) and a study groups card to home, and the employment type next to the dates of each role.
- Update the Kool Dev contribution with the Java and Spring Boot presets and API-driven automation actions (kool-dev/kool#542), extend its period to 2026 and list it first among open source contributions.
- Add HSTS, `X-Frame-Options`, `Permissions-Policy` and a Content-Security-Policy for every page, and cache `/_next/static/*` as immutable.
- Check the Cloudflare Terraform token before merge with the shared `fbrissi/github-actions` terraform-permissions workflow. `terraform/cloudflare-token-permissions.json` maps every Cloudflare resource and data source type to the permission groups it needs; CI fails when it drifts from `terraform/` or when the real `CLOUDFLARE_API_TOKEN` lacks a group. See `terraform/README.md`.

### Changed

- Migrate the DevTalk board (`0002_groups_and_accounts.sql`) into the `devtalk` group with no owner; the first sign-in of a platform admin claims it, and old suggestions and votes keep their typed names.
- Redirect the retired `/study-group/<slug>` URLs with a 301 to the DevTalk group, generated at build time from `STUDY_GROUP_SLUG`.
- Deploy the study group Worker with the `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `STUDY_GROUP_PLATFORM_ADMIN_EMAILS` secrets; create the Google OAuth client by hand and set its ID and secret, and the admin emails, as Terraform Cloud variables; Terraform publishes them as GitHub secrets and generates `STUDY_GROUP_UNSUBSCRIBE_SECRET` with `random_password` (README, Study Groups).
- Disable the sandbox environment with `sandbox_enabled = false` in `terraform/locals.tf`: the next apply deletes the sandbox Pages project, domain and DNS record, the sandbox D1 and its data, the sandbox contact and notification queues, and `sandbox.fbrissi.dev` in the Turnstile widget. Every sandbox Worker (study group API and mailer, contact API and consumer) now lives in its own `[env.sandbox]` with its own routes, D1, queues and, when enabled, SES key, kept as the reference; the production contact Workers no longer bind the sandbox queue or route. Deploy Sandbox runs only when the `SANDBOX_ENABLED` repository variable is `true`. Retire the old sandbox Worker before merging, and rehearse the release locally (README, Study Groups).
- Fail the Deploy and Deploy Sandbox workflows before deploying anything when a required secret is empty, now including `STUDY_GROUP_UNSUBSCRIBE_SECRET` and the SES key; both deploy the study group mailer Worker of their own environment before the API.
- After a join request is not approved, the same user can ask that group again only after 7 days; the join form shows the wait as a form error.
- Lead with "Backend & Cloud Engineer" / "Engenheiro Backend e Cloud" in the page titles, the `Person` job title and the profile, and replace the home banner, the commit-history embed and the repeated About text with a type-only hero (headline, proof subhead and calls to action). The large profile header now shows only on home; inner pages start compact.
- Trim the header to Home, About, Experience (`/works`), Projects, English groups (`/study-groups`, "Grupos de inglês" at `/pt-br/grupos-de-estudo-de-ingles` in Portuguese), Contact and Resume: Open Source becomes a section of Projects (`/open-source` redirects with a 301 to `/projects#open-source`, contribution pages stay), the study groups program is also linked from the footer (with the same label) and a home card, and Articles return to the header once there are three posts.
- List current roles first and the rest newest first by start date, and name the current role on About; say "since 2009" instead of "15+ years"; rename "Works" to "Experience"; write new meta descriptions; normalize the Mega Bilheteria, Exlink and Finch names.
- Replace the flag dropdown with a direct `Português` / `English` link, and point the article hreflang and the language switch to the translated slug (the old cross-locale URLs redirect with a 301).
- Build the sitemap `lastmod` from article dates and the last commit of each content file, without `changefreq` or `priority`, and drop the `keywords` meta tag and the root-layout title and description defaults.
- Resize the header photo to a 5 KB WebP and the email avatar to 512 px, give images explicit sizes and lazy-load card images.
- Raise the muted text contrast to 4.5:1, set body text to weight 400, show dates in sentence case at 14px, and drop eyebrows that repeat the page title.
- Optimize the study groups landing for search: the Portuguese landing moves to `/pt-br/grupos-de-estudo-de-ingles` (`/pt-br/study-groups` redirects with a 301; the terms page and the English-only app pages keep their paths), new titles and descriptions ("Free English Study Groups for Devs | Filipe Bojikian Rissi" / "Grupos de Estudo de Inglês para Devs | Filipe Bojikian Rissi"), with the Portuguese slugs in one shared `scripts/localized-slugs.json` read by the site, the sitemap and the redirects, a why-practice-in-groups intro, a "Start your own group" section, a 7-question FAQ, a no-JavaScript text for the group list, `WebPage` and `BreadcrumbList` structured data, and "Join a free English study group" as the signed-out call to action, which still starts the Google sign-in. Home moves the program card right after Nota Profile, and About and the project page link to it with descriptive text.
- Treat the Portuguese program page as an entry door only: its title, meta description and one highlighted notice are in Portuguese (the page is in English on purpose, because the practice starts with reading); the rest is the English program page, its Terms, Privacy Policy and Contact links open the Portuguese versions, and its structured data says `inLanguage: en`. Add `autocomplete` to the contact form name and email.
- Nota Profile: describe it as a product of Oliblish, say it is free during the beta without an end date, remove the placeholder stack notes, tag its links with the page locale in `utm_content`, link it with `noopener noreferrer`, and show it on home only as the featured card. Internal project links open in the same tab, and the location next to "Open project" is gone.
- Open external links in Markdown bodies in a new tab with `noopener noreferrer`, show bullets and numbers on Markdown lists, and keep Markdown headings plain with a `#` link on hover or focus.
- Show "Filipe Rissi" in the mobile header, and make the scrolled header opaque with a light blur.
- Give the study groups program its own address, `groups@fbrissi.dev` (Cloudflare Email Routing to the same inbox): the Reply-To of every notice, and the channel in the Terms, the Privacy Policy (both `2026-11-23`, a minor edit with no re-acceptance), the FAQ, the landing, the app footer and the ban email for program questions, abuse reports, ban appeals and study group data requests.
- Render every email through one shared layout (`workers/templates/email-layout.ts`) with named slots and a single escaper; the study group notices take the contact form look, and the contact emails look as before. Ban and restore notices drop `List-Unsubscribe` (they ignore the opt-out) and say so in the footer.
- Replace every remaining `window.confirm` (rotate the code, remove the icon, leave, remove a member, close or cancel a round, delete a material) and the admin's inline group-deletion reason with the in-page dialog, which now keeps the focus inside in both directions. Show status messages after material, member and group deletions (a one-time message on the next page), clear old messages when the next action starts, show readable moderation log actions, and name buttons with their visible label ("Renew ban for …", "Delete message from …").
- Show a rejected requester the rejection and when they can ask again on the group page and in My groups ("Not approved"), before any code is typed. Call it "Access code" everywhere. Announce the welcome page's missing boxes and move the focus to the first unchecked one.
- Refuse any host-like group name (a scheme, `www.`, an IPv4 address or any `label.tld`, any case) except common tech names (`*.js`, ASP.NET, VB.NET, ADO.NET, Socket.IO, .NET), and refuse invisible or text-direction characters and email addresses in display names, group names and summaries, with friendly messages from the API. The first display name from Google is cleaned the same way.
- Wrap Markdown tables in a horizontal scroller so the policy pages never scroll sideways on phones.
- Sign the contact confirmation email as "Backend & Cloud Engineer", and skip Zod's `new Function` probe so the CSP logs no violation.

### Fixed

- Fix the footer, which said the site was built with Vite, the fbrissi.dev project stack, the English "min read" on Portuguese articles, and the duplicate `<h1>` on every page (the header name is no longer a heading).
- Restore the header background when a page loads already scrolled.

### Removed

- Remove the access-code header, the typed member names (and clear the old `study-group:code` and `study-group:name` browser keys), and the email and PBKDF2 password settings login with `scripts/hash-study-group-password.mjs`; delete the `STUDY_GROUP_ADMIN_EMAIL` and `STUDY_GROUP_ADMIN_PASSWORD_HASH` secrets after the release.

## v0.3.3

### Changed

- Set the DMARC policy to `p=reject`. SES now sends `contact@fbrissi.dev` from Gmail and Spark and Cloudflare sends the contact form, all aligned with `fbrissi.dev`.
- Send DMARC aggregate reports to Cloudflare DMARC Management instead of an inbox, and document how to open its dashboard in the README.

## v0.3.2

### Changed

- Move the Code Review, release-note check, and release workflows to the shared reusable workflows in [`fbrissi/github-actions@v1`](https://github.com/fbrissi/github-actions). `code-review.yml`, `release.yml`, and `release-orchestrator.yml` are now thin callers, and releases gain idempotent tag and release creation.
- Dispatch Code Review on `main` instead of the pull request branch, and only after the quality checks pass (`CODE_REVIEW_ENABLED=false` turns it off), so a pull request can no longer change its own reviewer and open pull requests use the current review setup without a rebase. The review can use OpenCode or Claude Code through the `AI_HARNESS` variable and runs in the `code-review` environment.
- Split the GitHub App: `rissi-agent-ai` publishes the Code Review with a token scoped to read code and write reviews, and `rissi-terraform` manages GitHub Actions variables and secrets from Terraform Cloud.
- Update dependencies: `@aws-sdk/client-sqs` 3.1168.0, `axios` 1.21.1, `next` 16.4.6, `nodemailer` 10.5.0, `jsdom` 31.0.1, `typescript-eslint` 8.72.2, `vite` 8.3.8, and the Terraform provider lock file.
- Run the dependency audit through `scripts/audit-high.mjs`, which fails on high or critical advisories except dated entries in `audit-allowlist.json`. Allow the unpatched `picomatch` ReDoS advisory (GHSA-fc5q-39xc-vjpf), reachable only through dev and build tooling, until 2026-12-31.

## v0.3.1

### Fixed

- Parse the `wrangler d1 list --json` output without the trailing package-manager lines, so the deploy injects the study group D1 database IDs, applies the migrations, and deploys the study group API Worker (the login returned 405 because the Worker was never deployed).

## v0.3.0

### Added

- Add the unlisted DevTalk study group board at `/study-group/<slug>` (English only, `noindex`, no-referrer, out of the sitemap): members suggest materials, browse open and discussed items, and run a weekly random draw or vote; the winner is marked discussed manually. Members unlock the board with a shared access code; deletes are soft and restorable.
- Add the `/study-group/<slug>/settings` page, behind an email and PBKDF2 password login, to edit the group name, policy, meeting schedule and link, and access code, and to restore deleted materials.
- Add the `fbrissi-dev-study-group-api` Worker on `/api/study-group/*`, with the `fbrissi-dev-study-group` and `fbrissi-dev-sandbox-study-group` D1 databases (Terraform), rate limits, migrations applied on deploy, and a local `node:sqlite` service in Docker. The Terraform `CLOUDFLARE_API_TOKEN` needs the D1 Write permission and the `STUDY_GROUP_*` secrets must exist before the apply and deploy.

### Changed

- Run every workflow job on `${{ vars.CI_RUNNER || 'ubuntu-latest' }}` so the runner can be switched with the `CI_RUNNER` variable.

## v0.2.7

### Added

- Add the `fbrissi-dev-gmail-smtp` SES SMTP credential for Gmail and Spark "Send mail as" `@fbrissi.dev`, limited to `ses:SendRawEmail` on the `fbrissi.dev` identity, with the `gmail_smtp_username` and sensitive `gmail_smtp_password` Terraform outputs. The `fbrissi-dev-terraform` role needs the new `ProjectUsers` statement before the apply.

## v0.2.6

### Added

- Manage the `fbrissi.dev` SES identity in Terraform with restricted AWS access (dynamic credentials for the `fbrissi-dev-terraform` role, scoped to that identity): import the identity and its MAIL FROM created by `oliblish-dev/nota-profile`, and create the three Easy DKIM CNAMEs and the `mail.fbrissi.dev` MX and SPF records, with the MAIL FROM rejecting mail when its MX is missing.

## v0.2.5

### Changed

- Ignore major TypeScript updates in Dependabot until `typescript-eslint` supports TypeScript 7; the grouped update to 7.0.2 broke `yarn lint`.
- Ignore major Terraform provider updates in Dependabot; provider majors are upgraded manually.

## v0.2.4

### Changed

- Update react-markdown to 10.1.0, moving the Markdown styles to a wrapper element since the `className` prop was removed.
- Group every Dependabot update into a single pull request assigned to `fbrissi`, targeting the default branch.

## v0.2.3

### Changed

- Migrate to Tailwind CSS 4 with the theme defined in CSS and the `@tailwindcss/postcss` plugin.

## v0.2.2

### Changed

- Update React, pdfkit, ESLint 10, globals, TypeScript 6, Testing Library jest-dom 7, jsdom 31, and the Cloudflare Terraform provider.
- Dispatch Code Review from Quality Checks without the transition fallback.

## v0.2.1

### Changed

- Moved release-note validation into the required quality checks for pull requests targeting `main`.
- Deploy production and sandbox with a scoped Cloudflare token managed by Terraform, through Wrangler instead of the deprecated Pages action.
- Deploy only release tags reachable from `main`.
- Rotate the deployment token and Turnstile widget twice a year with the credential rotation workflow.
- Target Dependabot updates at `main`.
- Keep contact submissions that exhaust the delivery retries in dead-letter queues.
- Manage Email Routing activation and drop unknown addresses with Terraform.
- Run on Node.js 24 and update the GitHub Actions.
- Authenticate Terraform with a GitHub App and the Terraform variable `CLOUDFLARE_API_TOKEN`.
- Update Next.js, Axios, Nodemailer, Zod, PostCSS, and Vitest to fix vulnerable dependencies.

## v0.2.0

### Added

- feat: migrate the bilingual portfolio to Next.js App Router with static export
- feat: add manually triggered sandbox deployments for any selected branch at `sandbox.fbrissi.dev`
- feat: isolate sandbox contact submissions in a dedicated queue and identify sandbox emails
- feat: add environment labels for local and sandbox builds
- feat: validate contact forms with Zod and submit them through Axios

### Changed

- chore: add localized Next.js metadata, favicon configuration, and profile Open Graph imagery
- chore: persist Mailpit data in a Docker volume
- chore: rename the contact sender address from `noreply@fbrissi.dev` to `no-reply@fbrissi.dev`

## v0.1.8

### Changed

- chore: disable automatic confirmation emails until dynamic delivery is supported
- chore: update the contact email header color
- chore: rate-limit contact submissions by IP address and recipient email

## v0.1.7

### Changed

- feat: separate the contact email display recipient from the delivery address

## v0.1.6

### Added

- feat: refresh résumé content and PDF builder with pagination and heading hierarchy support
- feat: use avatar image as site favicon and apple-touch-icon
- feat: refresh Open Graph image to match current brand and avatar
- feat: add Cloudflare Pages `_headers` cache policy for assets, resumes, and brand images
- feat: send automated confirmation email to form submitter after contact form submission
- feat: localize confirmation email body based on form locale (EN/PT-BR)
- feat: add Reply-To `noreply@fbrissi.dev` header to confirmation email
- feat: add professional email signature with avatar to confirmation email
- feat: detect browser language and redirect to preferred locale on first visit
- feat: persist locale preference in localStorage; language switcher updates preference
- feat: add `contato@fbrissi.dev` Terraform email routing alias for typo resilience

### Changed

- chore: route contact email to `contact@fbrissi.dev` across local worker and email consumer config
- chore: point résumé open-source entries to portfolio pages only
- chore: remove `destination_address` restriction from `send_email` binding to allow sending to form submitters
- chore: add `locale` field to contact message queue payload; contact form POSTs locale
- chore: update success message to inform user a confirmation email will be sent
- chore: rename success button from "Try again" to "OK"
- chore: use `contact@fbrissi.dev` consistently (replace `contato@` in templates)

## v0.1.5

### Fixed

- fix: add mock for `cloudflare:email` in tests and update worker imports

## v0.1.4

### Fixed

- chore: enable observability in contact-api and email-consumer workers

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
