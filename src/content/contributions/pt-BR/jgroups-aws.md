---
title: "JGroups AWS"
repository: "jgroups-extras/jgroups-aws"
repositoryUrl: "https://github.com/jgroups-extras/jgroups-aws"
description: "Fortaleci a descoberta de clusters via S3 com tratamento mais seguro de endpoint, path-style, região e ACL."
period: "2021"
tags:
  - Java
  - AWS S3
  - Sistemas Distribuídos
evidence:
  - label: "PR #130"
    url: "https://github.com/jgroups-extras/jgroups-aws/pull/130"
  - label: "PR #133"
    url: "https://github.com/jgroups-extras/jgroups-aws/pull/133"
order: 5
---

## Minha contribuição

Adicionei acesso path-style configurável no S3 e corrigi o tratamento de endpoint e região no builder do cliente AWS SDK. Uma contribuição posterior reforçou a validação de endpoints vazios e evitou consultar o proprietário da conta S3 quando a opção de ACL com controle total não estava habilitada.

## Por que foi importante

As mudanças evitaram exceções durante a inicialização e respostas `403` desnecessárias na descoberta baseada em S3, ampliando a compatibilidade com diferentes ambientes AWS e serviços compatíveis com S3.
