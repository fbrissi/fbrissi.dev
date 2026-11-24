---
title: "Grupos de estudo de inglês"
description: "Um programa gratuito hospedado neste site em que qualquer pessoa pode criar ou entrar em um grupo de estudo de inglês: sugerir materiais, escolher o tema da semana e praticar a conversação juntos."
url: "/pt-br/grupos-de-estudo-de-ingles"
stack:
  - Next.js
  - TypeScript
  - Cloudflare Workers
  - Cloudflare D1
  - Login com Google
  - Terraform
  - Vitest
order: 2
---

Os grupos de estudo de inglês são uma iniciativa pessoal para ajudar as pessoas a criar seus próprios grupos. Ler em inglês costuma ser bem mais fácil do que falar, e um grupo pequeno que se encontra toda semana para conversar sobre um tema que todos prepararam é um jeito prático de diminuir essa distância. Qualquer pessoa pode criar ou entrar em um grupo; grupos com foco em tecnologia também são bem-vindos.

[Entre ou monte um grupo de estudo de inglês](/pt-br/grupos-de-estudo-de-ingles).

## Do DevTalk a um programa aberto

O programa nasceu do quadro do DevTalk, um grupo de estudo em que os membros sugeriam vídeos, artigos e livros e escolhiam o tema da semana. Aquele quadro não era listado e abria com um código de acesso compartilhado. O programa transforma isso em algo que qualquer pessoa pode usar: entrar, criar um grupo e convidar pessoas. O DevTalk passou a ser um grupo entre outros.

## Como um grupo funciona

1. Entre com o Google e aceite os Termos de Uso e a Política de Privacidade.
2. Crie um grupo com nome, um resumo público curto, regras e horário dos encontros, ou peça para entrar em um grupo (com o código de acesso dele, se ele exigir um).
3. O dono aprova cada pedido, então só membros aprovados veem o quadro.
4. Os membros sugerem materiais; o dono escolhe o tema da semana por sorteio ou votação.
5. O grupo se reúne na própria chamada e conversa sobre o tema em inglês.

O dono pode revisar as sugestões antes de aparecerem, trocar o código de acesso, remover membros e excluir conteúdo definitivamente. Cada pessoa pode criar até três grupos.

## Arquitetura

As páginas públicas fazem parte deste site estático em Next.js, em inglês e português. O quadro e as configurações ficam só em inglês, em páginas `noindex` servidas a partir de shells estáticos.

A API é um Cloudflare Worker com banco Cloudflare D1 e roda no plano gratuito da Cloudflare, então o programa não tem custo de hospedagem. Ela cuida de:

- **login com Google** pelo fluxo Authorization Code com PKCE, state e nonce, validando o ID token com as chaves públicas do Google
- **sessões** em cookies `__Host-`, guardadas apenas como hashes SHA-256, com verificação de origem contra CSRF
- **consentimento**: aceite explícito dos Termos e da Política de Privacidade e confirmação de maioridade antes de a conta existir, pedido de novo quando uma política muda de versão
- **moderação**: um administrador da plataforma pode agir em qualquer grupo, com motivo obrigatório, log de auditoria e avisos aos donos dentro do app
- **controles de privacidade**: cada pessoa pode editar o nome, exportar os próprios dados em JSON e excluir a conta
- **retenção**: um Cron Trigger diário apaga, nos prazos definidos, conteúdo excluído, pedidos de entrada antigos, o log de moderação e sessões expiradas
- **limite de tentativas** para entrar com código

Produção e sandbox rodam em Workers separados, cada um ligado apenas ao seu banco D1 e à sua origem. O Terraform gerencia os bancos, e as migrations rodam no deploy. Localmente, o Docker sobe a API com um provedor de identidade falso do Google, para testar o login de ponta a ponta sem depender do Google.

## Competências demonstradas

- **Produto:** transformar uma ferramenta privada em um programa self-service, com regras, políticas e moderação claras
- **Segurança:** OAuth com PKCE, cookies de sessão endurecidos, verificação contra CSRF e ambientes com privilégio mínimo
- **Privacidade:** registro de consentimento, exportação de dados, exclusão de conta e rotinas de retenção
- **Cloud:** Cloudflare Workers, D1, Cron Triggers e isolamento de ambientes com custo zero
- **Testes:** provedor de identidade e API locais para testes de ponta a ponta, com o limite de 100% de cobertura do site
