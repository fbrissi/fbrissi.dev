# E2E feature specification

The Gherkin files in this folder are the source of truth for the Playwright suite in `e2e/`. Every scenario, and every
Examples row of a Scenario Outline, is a plain Playwright test with exactly the same title. `yarn e2e:features`
(`scripts/check-e2e-features.mjs`) lists the tests with `playwright test --list` and fails when a scenario has no
test, a test has no scenario, or two scenarios share a title. CI runs it before the suite (`Quality / e2e`).

To change behaviour: edit the scenario, then the test with the same title. Steps are business language; the test is the
step implementation.

## Feature inventory

| Feature file | Capability | Entry points | Roles | Side effects | Main specs |
| --- | --- | --- | --- | --- | --- |
| `public-site.feature` | Bilingual portfolio, program pages, SEO, redirects, cookie notice, contact | `/`, `/pt-br`, `/projects`, `/contact`, `/privacy`, `/study-groups`, `/pt-br/grupos-de-estudo-de-ingles` | visitor | contact email | 00, 01, 10, 13 |
| `auth.feature` | Google sign-in, welcome and consent, sessions, re-consent | `/api/study-group/auth/*`, `/study-groups/welcome` | visitor, user, banned | session cookie | 02, 09, 15 |
| `groups.feature` | Create, join with code and approval, code rotation, listing, members, delete, caps | `/study-groups/new`, `/study-groups/g/<id>`, settings | user, requester, member, owner | join emails | 03, 04, 06, 10, 15 |
| `board.feature` | Suggestions, review-first mode, draw and vote rounds, content deletion | board | member, owner, admin | none | 04, 05, 10, 15 |
| `icons.feature` | Icon upload, checks, metadata stripping, signed links, caps | settings, `/api/study-group/icons/*` | owner, member, admin, visitor | R2 (local folder), icon email | 12, 16 |
| `admin.feature` | Moderation with reasons, log, bans | `/study-groups/admin` | platform admin | owner notices, emails | 07, 10, 12, 15 |
| `account.feature` | Display name, export, email setting, deletion | `/study-groups/account` | user | none | 08, 15 |
| `emails.feature` | Digest, decisions, deletion, ban and restore emails, unsubscribe | Mailpit | owner, requester, banned | emails | 11, 17 |
| `api-access.feature` | Role × route table, CSRF, content types, email exposure | `/api/study-group/*` | all callers | none | 04, 14 |

## Coverage matrix (roles per feature)

`allow` = the role performs the feature's actions; `deny` = scenarios check the refusal (401/403/409).

| Feature | Visitor | Forged cookie | Banned | Non-member | Pending | Member | Owner | Platform admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public-site | allow | | | | | | | |
| auth | allow | deny | deny | allow | | | | allow |
| groups | deny | | | allow | allow | allow | allow | allow |
| board | deny | | | deny | deny | allow | allow | allow (manage), deny (suggest, vote) |
| icons | deny (public pages) | | | | | allow (view) | allow | allow (remove), deny (upload) |
| admin | | | deny | deny | | deny | deny | allow |
| account | deny | | deny | allow | allow | allow | allow | allow |
| emails | | | allow (ban notice) | | allow | allow | allow | |
| api-access | deny | deny | deny | deny | deny | allow/deny | allow/deny | allow/deny |

The exact status per route and caller is the table in `e2e/14-api-access.e2e.ts`.

## Not covered end to end

- Rate limits (Cloudflare Workers rate limiting binding) and the 429s they return: the local API has no limiter; unit
  tests cover them.
- The expired session cookie and the trailing digest at the end of the 6-hour window: they need a clock or database
  change the suite can't make; unit tests cover them.
- Real Google sign-in, Amazon SES delivery, R2, Queues, the edge cache and Turnstile: only on Cloudflare.
