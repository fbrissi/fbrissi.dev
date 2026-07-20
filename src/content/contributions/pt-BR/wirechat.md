---
title: "WireChat"
repository: "wirechat/wirechat"
repositoryUrl: "https://github.com/wirechat/wirechat"
description: "Centralizei a resolução configurável de models e introduzi verificações compartilhadas de autorização por participante."
period: "2026"
tags:
  - PHP
  - Laravel
  - Autorização
evidence:
  - label: "PR #158"
    url: "https://github.com/wirechat/wirechat/pull/158"
  - label: "PR #189"
    url: "https://github.com/wirechat/wirechat/pull/189"
order: 9
---

## Resolução de models

Introduzi a resolução de models no nível de serviço para que o WireChat pudesse instanciar de forma consistente os models configuráveis da aplicação. A mudança também recebeu testes específicos para esse comportamento.

## Vínculo dos participantes

Adicionei verificações compartilhadas de vínculo dos participantes e depois fortaleci o tratamento de valores nulos e a cobertura contra regressões. Isso centralizou uma regra de autorização usada para validar se um model pertence a um participante da conversa.
