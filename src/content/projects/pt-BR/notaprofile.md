---
title: "Nota Profile"
description: "Emissor de NFS-e Nacional para escritórios de contabilidade, MEI e prestadores de serviço: você configura cada empresa uma vez e emite todo mês, nota a nota ou em lote."
url: "https://notaprofile.com.br/?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=project-page-pt-br"
stack:
  - SaaS
  - NFS-e Nacional
  - Certificado digital A1
  - Emissão recorrente
order: 1
---

O Nota Profile é um produto da Oliblish, minha empresa, que eu criei e lancei: uma plataforma web que emite notas fiscais de serviço (NFS-e) pelo padrão nacional, a NFS-e Nacional. Ele atende escritórios de contabilidade que cuidam de várias empresas clientes e também MEIs e autônomos que emitem as próprias notas.

[Crie sua conta grátis](https://app.notaprofile.com.br/cadastro?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=project-page-pt-br) ou [conheça o notaprofile.com.br](https://notaprofile.com.br/?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=project-page-pt-br).

## O problema

Desde a competência de novembro de 2026, MEI e ME/EPP do Simples Nacional precisam emitir a NFS-e pelo padrão nacional. Boa parte das notas de quem presta serviço se repete todo mês: mesmo tomador, mesmo serviço, valores parecidos. O Nota Profile guarda essa repetição em modelos, e o trabalho do mês vira conferir o que mudou e emitir.

## Como funciona

1. **Cadastre a empresa e envie o certificado A1.** Com o certificado, o Nota Profile consulta a NFS-e Nacional e configura sozinho a numeração das notas. O arquivo `.pfx` e a senha ficam criptografados.
2. **Escolha um perfil fiscal.** Há perfis prontos para médicos, desenvolvedores, contadores e outras atividades; se nenhum servir, você cria o seu.
3. **Crie um preset para cada tomador.** O preset é o modelo da nota: serviço, tomador e valores. Antes de valer, ele é emitido em homologação, sem valor fiscal, e você baixa o DANFSE para conferir.
4. **Emita.** No dia programado, a nota sai sozinha ou espera você revisar valor e descrição. Notas avulsas e emissão em lote partem dos mesmos presets.

## Para escritórios de contabilidade

- uma conta com várias empresas clientes, cada uma com seu certificado, perfis e presets
- colaboradores convidados, com papéis e permissões próprios, que só enxergam os espaços de trabalho para os quais foram convidados
- no fechamento do mês, você filtra as recorrências pendentes, ajusta só o que mudou e emite o lote

## Para quem exporta serviços

Desenvolvedores, designers e consultores PJ com clientes no exterior recebem a invoice comercial em inglês, em PDF e na moeda do contrato, gerada junto com a NFS-e de exportação a cada período. A invoice vai em um e-mail próprio para os destinatários que você definir, e também pode ser emitida sozinha.

## O que é conferido antes e depois de cada nota

- a numeração é acompanhada por empresa e nenhum número usado é reaproveitado; uma série própria permite manter outro emissor funcionando em paralelo
- quando a NFS-e Nacional recusa uma nota, você vê um resumo do problema ao lado da mensagem e do código originais
- depois da autorização, o tomador recebe o DANFSE e o XML por e-mail, e substituições e cancelamentos também são avisados
- notas autorizadas podem ser substituídas ou canceladas, inclusive com cancelamento em lote

O Nota Profile calcula o que é aritmética definida no layout oficial, como o ISS, o PIS/COFINS e o valor líquido. Alíquotas, bases de cálculo, retenções e enquadramento ficam com quem emite ou com o contador da empresa.

## Situação atual

O Nota Profile está em beta e já emite notas reais em produção. Qualquer plano é gratuito durante o beta com o cupom mostrado no card, e o cadastro não pede cartão de crédito. Os planos e os valores depois do beta estão na [seção de planos](https://notaprofile.com.br/?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=project-page-pt-br#planos).

## Stack

Aplicação web multiempresa integrada à NFS-e Nacional e ao envio de e-mails.

## Competências demonstradas

- **Produto:** levar um produto da ideia ao lançamento, com onboarding, planos, beta aberto e canal de suporte
- **Modelagem de domínio:** documentos fiscais brasileiros, perfis fiscais, séries de numeração, substituições e cancelamentos
- **Integração:** API governamental autenticada com o certificado digital da empresa, com ambientes de homologação e produção
- **Automação:** emissão recorrente e em lote, com etapa opcional de revisão humana
- **Multi-tenancy:** espaços de trabalho, usuários convidados, papéis e permissões
