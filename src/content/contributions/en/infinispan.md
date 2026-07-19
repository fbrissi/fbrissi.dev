---
title: "Infinispan"
repository: "infinispan/infinispan"
repositoryUrl: "https://github.com/infinispan/infinispan"
description: "Fixed Oracle JDBC index discovery and naming when database schemas are configured."
period: "2022"
tags:
  - Java
  - Oracle
  - Persistence
evidence:
  - label: "PR #9850"
    url: "https://github.com/infinispan/infinispan/pull/9850"
order: 6
---

## What I contributed

I corrected Oracle JDBC index lookup to pass the configured schema separately from the unqualified table name. The fix also prevented schema-qualified names from producing duplicated or incorrectly truncated index identifiers.

## Why it mattered

JDBC-backed Infinispan stores could initialize and inspect indexes correctly when deployed into explicitly configured Oracle schemas.
