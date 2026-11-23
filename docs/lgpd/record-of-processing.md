# Record of processing operations (simplified ROPA)

Internal document, not published on the site. LGPD art. 37, in the simplified model for small-scale processing
agents (agente de tratamento de pequeno porte, ATPP; CD/ANPD Resolution 2/2022, art. 9). Keep it consistent with the
published Privacy Policy (`src/content/study-groups/*/privacy.md`) and the code; update both in the same change.

- **Controller:** Filipe Bojikian Rissi, individual, Brazil.
- **Channel (no encarregado, Res. 2/2022 art. 11):** contact@fbrissi.dev and the contact page; for the study groups program (questions, abuse reports, data requests, banned users included), groups@fbrissi.dev.
- **ATPP status:** individual (art. 2, I), no exclusion under art. 3, no high-risk processing under art. 4 (no large
  scale, no sensitive data, no automated decisions, no minors: the program is 18+). Uses the doubled deadlines of
  arts. 14 and 15. Re-check if the program grows large or admits minors.
- **Last reviewed:** 2026-11-26 (policy version 2026-11-26).

| # | Activity | Data subjects | Data | Purpose | Legal basis (art. 7) | Providers | Retention |
|---|---|---|---|---|---|---|---|
| 1 | Contact form | Visitors who write | Name, email, subject, message, page language; IP transiently (Turnstile, rate limit) | Read and answer the message | IX legitimate interest; V pre-contract; II for data requests | Cloudflare (Workers, Queues, Email, Turnstile), Gmail (personal account), Amazon SES (replies) | Mailbox 12 months; DLQ 24 h; Workers Logs 7 days |
| 2 | Direct emails to contact@ / contato@ | Senders | Address, message, attachments, headers | Answer, including LGPD requests | II legal obligation; V pre-contract; IX otherwise | Cloudflare Email Routing, Gmail, Amazon SES | Mailbox 12 months |
| 3 | Study group accounts | Members (18+) | Google account ID, email, verification flag, name, display name, consents, session hash | Run the account | V contract (Terms) | Cloudflare (Workers, D1); Google processes the sign-in under its own policy | Until account deletion; sessions 30 days |
| 4 | Groups, memberships, requests, suggestions, votes, icons | Members | Content they post; icon images without metadata (R2); upload counters | Run the program | V contract | Cloudflare (D1, R2) | Until deleted (permanent, immediate); decided requests 30 days; upload counters 1 day |
| 5 | Service emails, including the ban and restore notices | Members | Email (read at send time), outbox record (type, group, reason, status, dates) | Tell members about requests, decisions, meetings (reminders the day before and on the day), admin deletions and bans | V contract | Cloudflare (Queues), Amazon SES | Outbox 30 days; DLQ 24 h |
| 6 | Moderation, bans and security | Members, visitors | Moderation log (label, reason, date, owner); ban records (user, Google ID, email, reason, admin, date, expiry); IP transiently | Keep the service safe, enforce the Terms | IX legitimate interest; VI exercise of rights | Cloudflare | Log 12 months; ban record while the ban lasts, at most 2 years from the ban or its last renewal |
| 7 | Error monitoring (whole site) | Visitors, members | Error message and code location, page or API path without query string, browser and OS, time, release; IP transiently (not stored: `scrub_ip_addresses`); emails redacted before sending | Find and fix failures | IX legitimate interest | Sentry (oliblish organization, shared with nota-profile) | Up to 90 days |

**International transfer:** Cloudflare, Google, Amazon Web Services and Sentry may store or process data outside Brazil,
including in the United States, under their contractual commitments and the safeguards allowed by LGPD art. 33, as the
Privacy Policy (section 6) says.
