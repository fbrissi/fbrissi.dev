---
title: "Keycloak"
repository: "keycloak/keycloak"
repositoryUrl: "https://github.com/keycloak/keycloak"
description: "Adicionei suporte a chaves RSA importadas para múltiplos algoritmos de criptografia, com registro do provider e testes de integração."
period: "2022"
tags:
  - Java
  - Identidade
  - Criptografia
evidence:
  - label: "PR #8553"
    url: "https://github.com/keycloak/keycloak/pull/8553"
featured: true
order: 1
---

## Minha contribuição

Adicionei um provider de chaves RSA importadas com suporte a **RSA1_5, RSA-OAEP e RSA-OAEP-256**. A mudança separou a configuração dos providers de assinatura e criptografia, mantendo a compatibilidade com chaves RSA importadas existentes.

A contribuição incluiu o registro do provider e testes de integração para os algoritmos de criptografia suportados.

## Por que foi importante

As instalações passaram a poder usar chaves RSA gerenciadas externamente especificamente para criptografia, com suporte explícito aos algoritmos e cobertura contra regressões na plataforma de identidade e controle de acesso do Keycloak.
