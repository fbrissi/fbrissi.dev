---
title: "Building a static portfolio that stays maintainable"
description: "Why this portfolio leans on static generation, small data files, and simple deployment primitives."
date: "2026-07-09"
tags:
  - Next.js
  - Cloudflare Pages
  - Terraform
---

<details>
<summary>Why keep the site static?</summary>

<p>For a personal portfolio, static output keeps the runtime surface small, removes operational overhead, and makes the site very fast to serve.</p>

</details>

The structure of this repository is intentionally boring:

- content lives in JSON and Markdown files
- React components only render data
- deployment is a static Cloudflare Pages upload

```ts
export function localizedPath(locale: 'en' | 'pt-BR', path: string) {
  return locale === 'pt-BR' ? `/pt-br${path}` : path;
}
```

That is enough for a single developer to maintain without extra ceremony.
