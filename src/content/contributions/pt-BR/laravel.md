---
title: "Ecossistema Laravel"
repository: "laravel/framework + laravel/jetstream"
repositoryUrl: "https://github.com/laravel"
description: "Corrigi o tratamento de uploads na validação, melhorei a precisão para análise estática e padronizei o feedback de botões desabilitados."
period: "2019-2021"
tags:
  - PHP
  - Laravel
  - Testes
evidence:
  - label: "Framework PR #27632"
    url: "https://github.com/laravel/framework/pull/27632"
  - label: "Framework PR #35076"
    url: "https://github.com/laravel/framework/pull/35076"
  - label: "Jetstream PR #712"
    url: "https://github.com/laravel/jetstream/pull/712"
featured: true
order: 3
---

## Tratamento de exceções de validação

Alterei o fluxo de exceções de validação do Laravel para preservar os dados comuns da requisição sem tentar reler arquivos enviados cujos streams temporários já poderiam ter sido consumidos ou removidos. A correção também recebeu testes de regressão.

## Precisão dos tipos do framework

Corrigi o parâmetro PHPDoc de `Query\Builder::selectSub()` de `$this` para `Query\Builder`. A alteração representa melhor o contrato do método e evita falsos erros em ferramentas de análise estática como o Psalm.

## Feedback visual no Jetstream

Adicionei um estado visual consistente a botões desabilitados nos stubs Blade e Inertia, permitindo reconhecer esses controles em todos os componentes de interface gerados.
