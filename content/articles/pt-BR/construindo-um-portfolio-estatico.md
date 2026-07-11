---
title: "Construindo um portfólio estático que continua fácil de manter"
description: "Por que este portfólio usa geração estática, arquivos pequenos de dados e primitivas simples de deploy."
date: "2026-07-09"
tags:
  - Next.js
  - Cloudflare Pages
  - Terraform
---

<details>
<summary>Por que manter o site estático?</summary>

<p>Para um portfólio pessoal, saída estática reduz a superfície de runtime, elimina overhead operacional e deixa o site muito rápido para servir.</p>

</details>

A estrutura deste repositório é propositalmente simples:

- o conteúdo vive em arquivos JSON e Markdown
- os componentes React apenas renderizam dados
- o deploy é um upload estático para Cloudflare Pages

```ts
export function localizedPath(locale: 'en' | 'pt-BR', path: string) {
  return locale === 'pt-BR' ? `/pt-br${path}` : path;
}
```

Isso é suficiente para uma pessoa manter sem cerimônia desnecessária.
