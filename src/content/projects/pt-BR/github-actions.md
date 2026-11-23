---
title: "github-actions"
description: "Workflows reutilizáveis e composite actions de GitHub Actions para code review com IA, releases a partir do changelog, espera do HCP Terraform e verificação de permissões do token da Cloudflare, compartilhados entre projetos pessoais."
url: "https://github.com/fbrissi/github-actions"
stack:
  - GitHub Actions
  - YAML
  - Bash
  - OpenCode
  - Claude Code
  - HCP Terraform
  - Cloudflare
order: 4
---

O `github-actions` é um repositório público, com licença MIT, de blocos reutilizáveis de CI/CD. Ele concentra o que se repete em todo projeto, enquanto matrizes de build, deploys e rotação de credenciais continuam em cada repositório. Quem consome fixa `@v1` e recebe as releases compatíveis, ou fixa uma versão exata ou o SHA de um commit.

[Explore o repositório no GitHub](https://github.com/fbrissi/github-actions).

## Catálogo

Workflows reutilizáveis:

- `code-review.yml`: review de pull request com IA, reportado como o check run `Code Review`
- `release-note.yml`: exige que cada pull request adicione uma release ao changelog
- `release.yml`: cria a tag e publica a release do changelog e, se configurado, dispara o deploy
- `terraform-permissions.yml`: falha antes do merge quando falta uma permissão ao token Terraform da Cloudflare

Composite actions:

- `ai-harness`: instala o OpenCode ou o Claude Code em versão fixada e executa um prompt
- `terraform-cloud-wait`: aguarda o apply do HCP Terraform de um commit
- `terraform-permissions`: confere um manifesto de permissões da Cloudflare contra o token real

## Code review com IA

O workflow de Code Review cria um check run no pull request, executa a review com OpenCode ou Claude Code e confirma que um GitHub App publicou a review do commit mais recente. A skill de review vem de uma release fixada do [`ai-skills`](https://github.com/fbrissi/ai-skills), nunca do próprio pull request revisado.

O workflow é disparado a partir da branch padrão, então um pull request não consegue alterar o próprio revisor. A ferramenta de IA recebe um token de curta duração do App, limitado a ler código e escrever reviews, e o cache de dependências é só de leitura durante as reviews, para que um pull request não contamine o cache usado pelas próximas.

## Releases a partir do changelog

O `release-note.yml` reprova o pull request que não adiciona exatamente um novo título `## vX.Y.Z` com notas. Depois do merge, o `release.yml` obtém a versão e as notas do changelog, aguarda o apply do HCP Terraform quando a infraestrutura mudou, cria a tag e a release no GitHub de forma idempotente e dispara o workflow de deploy na tag.

## Uso neste site

Este portfólio chama quatro dos workflows reutilizáveis: o Code Review dos pull requests, a verificação da release note, o orquestrador de releases e a verificação do token Terraform da Cloudflare. Os workflows do site ficam reduzidos a chamadas que passam inputs e secrets.

## Competências demonstradas

- **CI/CD:** workflows reutilizáveis, composite actions, Semantic Versioning para actions e fixação pela tag de major
- **Segurança:** permissões mínimas por job, tokens de GitHub App com escopo reduzido, ferramentas em versões fixadas e entradas não confiáveis passadas só por variáveis de ambiente
- **Engenharia de release:** tags e releases a partir do changelog, espera da infraestrutura e disparo do deploy
- **Engenharia de IA:** um revisor automatizado que o pull request não consegue alterar
