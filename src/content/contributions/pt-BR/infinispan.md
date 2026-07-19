---
title: "Infinispan"
repository: "infinispan/infinispan"
repositoryUrl: "https://github.com/infinispan/infinispan"
description: "Corrigi a descoberta e os nomes de índices JDBC no Oracle quando um schema de banco de dados é configurado."
period: "2022"
tags:
  - Java
  - Oracle
  - Persistência
evidence:
  - label: "PR #9850"
    url: "https://github.com/infinispan/infinispan/pull/9850"
order: 6
---

## Minha contribuição

Corrigi a consulta de índices via JDBC no Oracle para enviar separadamente o schema configurado e o nome da tabela sem qualificação. A correção também impediu que nomes com schema produzissem identificadores de índices duplicados ou truncados incorretamente.

## Por que foi importante

Stores do Infinispan baseados em JDBC passaram a inicializar e consultar índices corretamente quando implantados em schemas Oracle configurados explicitamente.
