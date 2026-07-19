---
name: safe-node-package
description: Safe npm package selection and installation for Node.js projects. Use BEFORE recommending, adding, or installing any new npm, Yarn, pnpm, or Bun dependency to prevent hallucinated names, typosquatting, dependency confusion, malicious packages, and incompatible package choices.
---

# Safe Node Package Selection

Apply this skill before introducing any new direct Node.js dependency or development dependency. Its purpose is to prevent an AI from guessing a plausible package name and accidentally selecting a malicious, abandoned, impersonating, or incompatible package.

This is a mandatory trust gate. Do not edit `package.json`, modify a lockfile, or run an add/install command for a new package until the checks below pass.

## Scope

Use this skill when:

- adding or recommending a new npm package;
- selecting a package to solve an implementation problem;
- translating a library or product name into an npm package name;
- choosing between similarly named packages;
- adding a package suggested by an issue, generated answer, blog post, or code snippet;
- replacing an internal implementation with a third-party package.

This skill is not a general dependency audit. Existing dependency upgrades and vulnerability reviews are outside its scope unless the task also introduces a new package.

## Non-Negotiable Rules

1. **Never choose an exact package name from memory alone.** Treat remembered names as unverified search terms.
2. **Never install a package merely because its name looks correct.** Plausible names are a common typosquatting and hallucination risk.
3. **Verify identity using at least two linked authoritative sources:**
   - the npm registry entry for the exact package name; and
   - the project's official documentation or source repository explicitly linking back to that exact npm package.
4. **Do not trust search ranking, download count, badges, README claims, or name similarity as identity proof.**
5. **Do not use an unofficial wrapper when the official package or platform API satisfies the requirement.**
6. **Do not add a package when the repository already has the capability or the requirement can be implemented safely with a small amount of maintainable code.**
7. **Do not install first and investigate later.** Registry and repository inspection must happen before package-manager execution.
8. **Stop and ask the user before installation if identity, ownership, provenance, maintenance, or compatibility cannot be established confidently.**
9. **Never expose registry credentials, private package metadata, tokens, or environment values in commands or reports.**
10. **Respect repository instructions and its existing package manager.** Do not introduce a second lockfile or run another package manager.

## Project Constraints

For this repository:

- use Yarn 1 through Kool;
- never run Yarn directly on the host;
- use `kool run yarn add <package>` or `kool run yarn add --dev <package>` only after approval by this workflow;
- preserve `yarn.lock` and the existing dependency version style;
- consult `AGENTS.md` before installation;
- run the repository validation commands after installation.

If this skill is reused elsewhere, derive the equivalent rules from that repository's instructions, lockfiles, and `packageManager` field.

## Selection Workflow

### 1. Prove A Dependency Is Necessary

Before searching for packages:

1. State the capability needed in one sentence.
2. Check the language runtime, browser, framework, and dependencies already present for that capability.
3. Estimate whether a small local implementation would be safer and easier to maintain.
4. Reject a new dependency if its value does not justify its code, transitive graph, update burden, and supply-chain exposure.

Proceed only when a third-party package is justified.

### 2. Discover Candidates Without Guessing

Build a shortlist from authoritative discovery paths:

- the framework or platform's current official documentation;
- the official repository or organization for the library;
- the npm registry;
- a package name explicitly documented by the upstream project.

For non-obvious choices, compare two or three credible candidates. Do not search npm for a guessed name and accept the first exact-looking result.

Record for each candidate:

- exact npm name, including scope;
- official repository URL;
- official documentation URL;
- purpose and API fit;
- whether it is official, community-maintained, or an unofficial wrapper.

### 3. Verify Package Identity

The package passes identity verification only when all applicable checks agree:

- the npm registry's `repository` field points to the expected official repository;
- the official repository or documentation names and links to the exact npm package;
- the package scope belongs to the expected organization when a scope is used;
- the npm homepage, repository, maintainers, and README describe the same project;
- there is no spelling variation, homoglyph, extra separator, reversed word, suspicious suffix, or near-name package being substituted;
- deprecated or renamed packages redirect to a documented successor rather than an arbitrary similarly named package.

Useful read-only metadata commands include:

```bash
npm view <exact-name> name version dist-tags repository homepage maintainers time license engines peerDependencies dependencies deprecated scripts --json
```

Use the repository's container or approved execution wrapper when required. `npm view` is for metadata inspection only; it must not create an npm lockfile in a Yarn, pnpm, or Bun project.

If the official repository does not link back to the package, identity is **unverified** even if npm metadata points to the repository.

### 4. Inspect Trust And Supply-Chain Signals

Evaluate the exact candidate and intended version:

- publication age and complete version history;
- recent ownership or maintainer changes;
- whether the repository is archived, transferred, or unexpectedly replaced;
- npm provenance information when available;
- release tags and source history corresponding to the published version;
- unexplained gaps between repository releases and npm publications;
- package deprecation or yanked/problematic releases;
- install, preinstall, postinstall, prepare, and binary-download scripts;
- bundled native binaries, remote downloads, telemetry, or code generation;
- size and contents of the published package;
- unexpected transitive dependencies or dependency growth;
- license compatibility with the repository.

Inspect the intended tarball without installing it when further verification is needed. Prefer registry metadata and a dry-run package inspection that does not execute lifecycle scripts. Never execute code from an untrusted candidate merely to inspect it.

Treat these as stop signals requiring user confirmation or rejection:

- a package published very recently with little verifiable project history;
- a name that closely imitates a popular package;
- npm metadata and official repository links that disagree;
- an unexplained maintainer or ownership transfer;
- obfuscated source or an npm tarball that does not correspond to public source;
- install scripts that download or execute remote content without a clear, necessary reason;
- a package claiming to be official without confirmation from the official project;
- missing repository, license, release history, or maintainer information;
- unresolved malware reports or a security advisory affecting the intended version.

Popularity can support a maintenance assessment, but it cannot override a failed identity or trust check.

### 5. Verify Compatibility And Reliability

Do not select `latest` automatically. Select the newest stable version that is compatible with the repository.

Check:

- Node.js and package-manager version requirements;
- ESM/CommonJS format and bundler compatibility;
- framework and peer dependency ranges;
- browser and server runtime expectations;
- TypeScript types and supported TypeScript versions;
- operating-system and CPU requirements;
- native build requirements;
- tree-shaking and client-bundle impact for frontend dependencies;
- maintenance status, release notes, and known breaking changes;
- whether the package API actually supports the required behavior in the selected version.

Use current official documentation for version-specific APIs. Never infer compatibility solely from TypeScript compiling a generated example.

### 6. Check Security Evidence

Before installation, check the exact intended version against available authoritative advisory sources such as:

- GitHub Security Advisories;
- OSV;
- npm advisory data;
- the upstream project's security policy and advisories.

Distinguish package identity risk from known-vulnerability risk. A package with no published advisories may still be malicious or untrustworthy.

### 7. Present The Decision

Before installation, provide a concise decision record:

```markdown
## Package Decision

- Capability: What the code needs
- Selected package: exact-name@version
- Dependency type: runtime | development
- Official identity: npm URL + official repository/docs URL
- Why this package: API fit and advantages over alternatives
- Alternatives considered: packages or local implementation
- Trust signals: maintainers, provenance, release history, package contents
- Lifecycle scripts: none | exact scripts and justification
- Compatibility: Node, framework, peers, module format, TypeScript
- Security: advisory result for the selected version
- Residual risk: anything not independently verified
- Decision: approve | reject | ask user
```

Do not install when the decision is `reject` or `ask user`.

## Installation Workflow

Only after an `approve` decision:

1. Use the repository's existing package manager and wrapper.
2. Add the package to the correct dependency class.
3. Do not add multiple exploratory packages.
4. Inspect the manifest and lockfile diff immediately.
5. Confirm that the resolved package name, version, source, integrity, dependencies, and lifecycle behavior match the approved candidate.
6. Check for unexpected lockfile churn, duplicate major versions, peer warnings, or additional packages with suspicious names.
7. Run the package manager's audit capability and interpret findings in repository context.
8. Run the smallest relevant tests, then the repository's required lint, typecheck, test, and build commands.
9. Remove the dependency if verification changes after installation or the package does not provide the expected value.

For this repository, use:

```bash
kool run yarn add <exact-name>@<approved-range>
# or
kool run yarn add --dev <exact-name>@<approved-range>

kool run yarn lint
kool run yarn typecheck
kool run yarn test:coverage
kool run yarn build
```

## Final Report

After installation, report:

- the exact dependency and resolved version added;
- why it was selected and how identity was verified;
- lifecycle scripts and notable transitive dependencies;
- manifest and lockfile changes;
- audit and validation results;
- residual risks or follow-up maintenance.

## Trigger Examples

Load this skill for requests such as:

- "Install a package for parsing dates."
- "Add an npm library for this feature."
- "Which React package should we use for this component?"
- "Add a development dependency for testing."
- "Find the official SDK package and install it."
- "Use a library instead of implementing this ourselves."
