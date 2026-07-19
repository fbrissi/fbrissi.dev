---
title: "Apache Commons Net"
repository: "apache/commons-net"
repositoryUrl: "https://github.com/apache/commons-net"
description: "Melhorei a compatibilidade do modo passivo do FTP quando servidores retornam o endereço inválido 0.0.0.0."
period: "2018-2020"
tags:
  - Java
  - FTP
  - Redes
evidence:
  - label: "PR #28"
    url: "https://github.com/apache/commons-net/pull/28"
  - label: "Commit"
    url: "https://github.com/apache/commons-net/commit/d497b4617c7fbb387de3929ea0fa3b1f912c7928"
featured: true
order: 2
---

## Minha contribuição

Atualizei o `FTPClient` para lidar com servidores FTP que retornam `0,0,0,0` na resposta do modo passivo. Nesse caso, o cliente passou a utilizar o endereço do servidor obtido pela conexão de controle, em vez de tentar conectar a um endereço inválido.

## Por que foi importante

A correção evita falhas em conexões FTP passivas com servidores e configurações de rede que substituem por zeros o endereço anunciado para o canal de dados.

A mudança foi posteriormente integrada ao Apache Commons Net pelo PR #28, relacionado à issue NET-649.
