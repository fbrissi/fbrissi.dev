---
title: "WireChat"
repository: "wirechat/wirechat"
repositoryUrl: "https://github.com/wirechat/wirechat"
description: "Centralized configurable model resolution and introduced shared participant-ownership authorization checks."
period: "2026"
tags:
  - PHP
  - Laravel
  - Authorization
evidence:
  - label: "PR #158"
    url: "https://github.com/wirechat/wirechat/pull/158"
  - label: "PR #189"
    url: "https://github.com/wirechat/wirechat/pull/189"
order: 9
---

## Model resolution

I introduced service-level model resolution so WireChat could consistently instantiate configurable application models. Tests were added around the resolution behavior.

## Participant ownership

I added shared participant-ownership checks and then hardened their null handling and regression coverage. This centralized an authorization concern used when validating whether a model belongs to a conversation participant.
