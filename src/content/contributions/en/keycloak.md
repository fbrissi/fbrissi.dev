---
title: "Keycloak"
repository: "keycloak/keycloak"
repositoryUrl: "https://github.com/keycloak/keycloak"
description: "Added imported RSA encryption-key support for multiple algorithms, with provider registration and integration coverage."
period: "2022"
tags:
  - Java
  - Identity
  - Cryptography
evidence:
  - label: "PR #8553"
    url: "https://github.com/keycloak/keycloak/pull/8553"
featured: true
order: 1
---

## What I contributed

I added an imported RSA encryption-key provider supporting **RSA1_5, RSA-OAEP, and RSA-OAEP-256**. The change separated signing and encryption provider configuration while maintaining compatibility with existing imported RSA keys.

The contribution included provider registration and integration tests covering the supported encryption algorithms.

## Why it mattered

Deployments could use externally managed RSA keys specifically for encryption, with explicit algorithm support and regression coverage in Keycloak's identity and access-management stack.
