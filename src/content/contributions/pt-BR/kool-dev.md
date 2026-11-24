---
title: "Kool Dev"
repository: "ecossistema kool-dev"
repositoryUrl: "https://github.com/kool-dev"
description: "Adicionei ao CLI do Kool presets de Java e Spring Boot com automação via API, depois de anos contribuindo com suporte multiplataforma, imagens Docker e charts de Kubernetes no ecossistema."
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
  - label: "Presets de Java e Spring Boot"
    url: "https://github.com/kool-dev/kool/pull/542"
  - label: "Suporte a Windows"
    url: "https://github.com/kool-dev/kool/pull/43"
  - label: "Profiles do Compose"
    url: "https://github.com/kool-dev/kool/pull/392"
  - label: "Melhorias no Helm"
    url: "https://github.com/kool-dev/charts/pull/18"
  - label: "Imagens Java"
    url: "https://github.com/kool-dev/docker-java/pull/1"
featured: true
order: 1
---

## Presets de Java e Spring Boot

Minha maior contribuição para o CLI do Kool ([kool-dev/kool#542](https://github.com/kool-dev/kool/pull/542), integrada em novembro de 2026, cerca de 1.700 linhas em 41 arquivos) adiciona presets para criar projetos Java com Gradle e aplicações Spring Boot em Java ou Kotlin, nas JDKs 17, 21 e 25, usando as imagens oficiais do Gradle.

A mesma mudança traz receitas de banco de dados e cache (H2, SQLite, PostgreSQL 16, MongoDB, Redis e Memcached) e ações de automação por input e via API, para que um projeto possa ser criado sem perguntas interativas. Tudo foi validado de ponta a ponta: os projetos gerados compilam, passam nos testes e sobem com status saudável, com testes de race, CodeQL e govulncheck no CI.

## Ferramentas de desenvolvimento multiplataforma

Contribuí com suporte e empacotamento para Windows, correções no comportamento de UID nesse sistema, configuração de redes Docker e suporte a profiles do Docker Compose no CLI do Kool.

## Imagens de containers

Nos repositórios de imagens do Kool, ajudei a estabelecer imagens Java baseadas no Amazon Corretto, adicionei variantes com Gradle, corrigi a publicação de imagens, ampliei configurações das imagens PHP, implementei usuários SSH e chaves autorizadas configuráveis e criei as primeiras imagens do developer toolkit para fluxos com Terraform e AWS.

## Kubernetes e Helm

Contribuí para a base dos charts Helm e para melhorias posteriores, incluindo services do tipo external name, tratamento da versão do Docker-in-Docker, correções no HPA e configuração de `ingressClassName`.

O trabalho atravessa vários repositórios e representa uma contribuição contínua para desenvolvimento local, CI, containers e ferramentas de deploy.
