---
title: "fbrissi.dev"
description: "Um portfólio bilíngue orientado a conteúdo, com infraestrutura Cloudflare, entrega automatizada, quality gates rigorosos e code review assistido por IA."
url: "https://github.com/fbrissi/fbrissi.dev"
stack:
  - React 19
  - TypeScript
  - Vite
  - Cloudflare
  - Terraform
  - GitHub Actions
  - Vitest
  - Engenharia assistida por IA
order: 1
---

O `fbrissi.dev` é o repositório público que mantém este portfólio. Ele foi projetado como um pequeno sistema de produção, e não apenas como uma coleção de páginas estáticas: conteúdo, aplicação, serviços serverless, infraestrutura, testes, releases e revisão assistida por IA convivem em uma única base de código auditável.

[Explore o código-fonte no GitHub](https://github.com/fbrissi/fbrissi.dev).

## Produto e arquitetura frontend

A aplicação é um site bilíngue em React 19 construído com **Next.js, TypeScript e Tailwind CSS**, usando exportação estática para o Cloudflare Pages. As rotas em inglês ficam na raiz e as rotas em português sob `/pt-br`, com todas as páginas pré-renderizadas durante o build.

O conteúdo editorial é separado da apresentação e mantido em Markdown e JSON localizados. O build gera um manifesto tipado do conteúdo, enquanto utilitários reutilizáveis de parsing e collections oferecem acesso a artigos, projetos, experiências profissionais e informações de perfil.

O frontend também inclui:

- layouts responsivos para desktop e mobile
- títulos, descrições, URLs canônicas e idiomas alternativos por rota
- metadados Open Graph e Twitter
- JSON-LD para pessoa, website e artigos
- geração de `sitemap.xml` e `robots.txt`
- navegação acessível e páginas de recuperação localizadas

## Fluxo serverless de contato

O formulário de contato utiliza uma arquitetura assíncrona na Cloudflare:

1. O navegador valida o formulário e obtém um token do **Cloudflare Turnstile**.
2. Um Cloudflare Worker valida a requisição e o captcha antes de aceitá-la.
3. O Worker publica uma mensagem normalizada no **Cloudflare Queues**.
4. Um consumidor separado monta versões texto e HTML do e-mail e realiza o envio por meio de um binding do Cloudflare Email.

A fila desacopla a requisição pública da entrega do e-mail, mantém a resposta da API rápida e permite repetir entregas com falha sem pedir que o visitante reenvie o formulário. Validação de entrada, CORS restritivo, verificação do Turnstile, sanitização de headers e bindings secretos reduzem a superfície pública de ataque.

## Infrastructure as Code

O Terraform gerencia o projeto no Cloudflare Pages, domínio customizado, fila de contato, widget Turnstile e a variável e o secret do GitHub Actions necessários para os deploys. O Terraform Cloud também participa do fluxo de release: versões que alteram a infraestrutura aguardam o apply correspondente antes da criação da tag e do deploy da aplicação.

O desenvolvimento local reproduz as responsabilidades de produção com **Kool, Docker Compose, LocalStack SQS e Mailpit**. Assim, o fluxo completo de formulário, fila, consumidor e e-mail pode ser testado sem utilizar os serviços de produção.

## CI/CD e engenharia de release

O GitHub Actions executa jobs independentes para lint, TypeScript, build de produção, cobertura de testes e validação do Terraform. Os testes usam Vitest, Testing Library e cobertura V8 com limite global de **100% para statements, branches, functions e lines**.

O fluxo de release adiciona proteções operacionais importantes:

- pull requests devem incluir exatamente uma entrada de changelog com Semantic Versioning
- tags de release são validadas antes do deploy
- alterações no Terraform aguardam a execução correspondente no Terraform Cloud
- builds versionados publicam a aplicação estática no Cloudflare Pages
- os Workers de contato são publicados separadamente pelo Wrangler
- controles de concorrência evitam deploys de produção sobrepostos

## Engenharia assistida por IA

A IA está integrada ao processo de engenharia, e não apresentada como uma funcionalidade artificial da aplicação. Após a aprovação dos quality checks, um workflow dedicado instala o **OpenCode**, autentica por meio de um GitHub App com escopo limitado e executa uma revisão automatizada do pull request com modelo e variante de raciocínio configuráveis.

O repositório também contém instruções específicas para agentes, documentando arquitetura, comandos, convenções de conteúdo, restrições de segurança e expectativas de validação. Isso oferece contexto confiável às ferramentas de implementação e revisão por IA, mantendo suas alterações sujeitas aos mesmos testes, requisitos de cobertura, processo de revisão e controles de release aplicados ao código escrito por pessoas.

## Competências demonstradas

Este projeto exercita experiência prática em várias disciplinas de engenharia:

- **Frontend:** React, TypeScript, roteamento, design responsivo, acessibilidade, Markdown e SEO
- **Backend:** validação de requisições, APIs serverless, processamento assíncrono, composição de e-mails e retries
- **Cloud:** Cloudflare Pages, Workers, Queues, Turnstile, Email Routing e secret bindings
- **Infraestrutura:** Terraform, Terraform Cloud, separação de ambientes e Infrastructure as Code
- **Entrega:** GitHub Actions, automação de releases, Semantic Versioning, orquestração de deploy e quality gates
- **Testes:** testes unitários, de componentes, rotas, Workers, infraestrutura local e cobertura rigorosa
- **Arquitetura:** separação de conteúdo, entrega static-first, fluxos orientados a eventos, segurança e simplicidade operacional
- **IA:** assistência contextual à implementação, análise automatizada de pull requests, configuração de modelos e automação de reviews
