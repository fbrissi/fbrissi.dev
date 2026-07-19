---
title: "JGroups AWS"
repository: "jgroups-extras/jgroups-aws"
repositoryUrl: "https://github.com/jgroups-extras/jgroups-aws"
description: "Hardened S3-based cluster discovery through safer endpoint, path-style, region, and ACL handling."
period: "2021"
tags:
  - Java
  - AWS S3
  - Distributed Systems
evidence:
  - label: "PR #130"
    url: "https://github.com/jgroups-extras/jgroups-aws/pull/130"
  - label: "PR #133"
    url: "https://github.com/jgroups-extras/jgroups-aws/pull/133"
order: 5
---

## What I contributed

I added configurable S3 path-style access and corrected endpoint and region handling in the AWS SDK client builder. A follow-up tightened validation for empty endpoints and avoided retrieving the S3 account owner unless the full-control ACL option was enabled.

## Why it mattered

These changes prevented initialization exceptions and unnecessary `403` responses in S3-backed discovery, improving compatibility with different AWS and S3-compatible environments.
