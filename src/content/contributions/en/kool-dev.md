---
title: "Kool Dev"
repository: "kool-dev ecosystem"
repositoryUrl: "https://github.com/kool-dev"
description: "Added Java and Spring Boot presets with API-driven automation to the Kool CLI, after years of cross-platform tooling, Docker images and Kubernetes charts across the ecosystem."
period: "2020-2026"
tags:
  - Go
  - Java
  - Spring Boot
  - Gradle
  - Docker
  - Kubernetes
  - Helm
evidence:
  - label: "Java and Spring Boot presets"
    url: "https://github.com/kool-dev/kool/pull/542"
  - label: "Windows support"
    url: "https://github.com/kool-dev/kool/pull/43"
  - label: "Compose profiles"
    url: "https://github.com/kool-dev/kool/pull/392"
  - label: "Helm improvements"
    url: "https://github.com/kool-dev/charts/pull/18"
  - label: "Java images"
    url: "https://github.com/kool-dev/docker-java/pull/1"
featured: true
order: 1
---

## Java and Spring Boot presets

My largest contribution to the Kool CLI ([kool-dev/kool#542](https://github.com/kool-dev/kool/pull/542), merged in November 2026, about 1,700 lines across 41 files) adds presets to create Java projects with Gradle and Spring Boot applications in Java or Kotlin, on JDK 17, 21 and 25, using the official Gradle images.

The same change adds database and cache recipes (H2, SQLite, PostgreSQL 16, MongoDB, Redis and Memcached) and input- and API-driven automation actions, so a project can be created without interactive prompts. It was validated end to end: generated projects build, pass their tests and start with a healthy status, with race tests, CodeQL and govulncheck in CI.

## Cross-platform developer tooling

I contributed Windows support and packaging, corrected Windows UID behavior, added Docker network handling, and introduced Docker Compose profile support to the Kool CLI.

## Container images

Across Kool's image repositories, I helped establish Java images based on Amazon Corretto, added Gradle variants, fixed image publishing, expanded PHP environment support, implemented configurable SSH users and authorized keys, and created the initial developer-toolkit images for Terraform and AWS workflows.

## Kubernetes and Helm

I contributed to Kool's Helm chart foundations and later improvements, including external-name services, Docker-in-Docker version handling, HPA targeting fixes, and configurable `ingressClassName` support.

The work spans several repositories and reflects sustained contribution to local development, CI, containers, and deployment tooling.
