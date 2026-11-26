# Dependency updates

Profile of the fbrissi/ai-skills `dependency-updates` skill for this repository, run weekly by `.github/workflows/ai-dependency-update.yml`.

## Scope
- Ecosystems: npm, terraform
- Directories: npm: /; terraform: /terraform
- Bots: dependabot   # one grouped PR, branch dependabot/dependencies-*, Monday 09:00 America/Sao_Paulo
- Outdated: none

## Branch and PR
- Base branch: main
- Branch template: chore/dependency-updates-{date}   # the App cannot create `release/*` branches (protected-branches ruleset); every PR into main is a release anyway
- Labels: dependencies

## Never update
- github-actions (`.github/workflows/**`): the agent's App token has no `Workflows` permission, so it cannot push workflow changes; leave those updates in the Dependabot PR for a person.

## Hold
- typescript: major versions stay with people (Dependabot ignores them too).
- Terraform providers: major versions stay with people (Dependabot ignores them too).

## Validation
- Checks: the Validation commands in `AGENTS.md` (`yarn lint`, `yarn typecheck`, `yarn test:coverage`, `yarn build`, `yarn e2e:features`, and the E2E suite), run through Kool when available, else with `yarn` directly.
- Extra validation: for Terraform provider updates, `terraform -chdir=terraform init -backend=false && terraform -chdir=terraform validate`, and check `terraform/cloudflare-token-permissions.json` as `AGENTS.md` (Terraform Credentials) says; for Next.js, React, or Wrangler updates, build and check direct navigation in both locales.
- Release notes: one new `## vX.Y.Z` section (next patch) at the top of `CHANGELOG.md`, as `AGENTS.md` (Releases) says. Merging the PR releases and deploys that version.

## Schedule
- Dependabot runs Monday 09:00 America/Sao_Paulo (12:00 UTC); this run starts Monday 15:00 UTC.
