---
title: "Apache Commons Net"
repository: "apache/commons-net"
repositoryUrl: "https://github.com/apache/commons-net"
description: "Improved FTP passive-mode compatibility when servers return an unusable 0.0.0.0 address."
period: "2018-2020"
tags:
  - Java
  - FTP
  - Networking
evidence:
  - label: "PR #28"
    url: "https://github.com/apache/commons-net/pull/28"
  - label: "Commit"
    url: "https://github.com/apache/commons-net/commit/d497b4617c7fbb387de3929ea0fa3b1f912c7928"
featured: true
order: 2
---

## What I contributed

I updated `FTPClient` to handle FTP servers that return `0,0,0,0` in a passive-mode response. In that case, the client now falls back to the server address from the control connection instead of trying to connect to an unusable address.

## Why it mattered

The fix prevents passive FTP connection failures with servers and network configurations that replace the advertised data-channel address with zeroes.

The change was later integrated upstream through Apache Commons Net PR #28 under issue NET-649.
