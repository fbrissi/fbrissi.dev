---
title: Política de Privacidade
description: Como o fbrissi.dev, o formulário de contato e o programa de grupos de estudo de inglês coletam, usam e protegem dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD).
version: '2026-11-21'
---

Esta política explica como o `fbrissi.dev` trata dados pessoais conforme a Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018, "LGPD"): o formulário de contato (seção 2) e o programa de grupos de estudo de inglês em `fbrissi.dev/study-groups` (seções 3 a 5, 7 e 11); a seção 6 vale para os dois. Navegar pelo restante do site não exige nenhum dado pessoal. Para usuários no Brasil, esta versão em português prevalece sobre a [versão em inglês](/privacy).

## 1. Controlador e contato

O controlador é **Filipe Bojikian Rissi**, pessoa física residente no Brasil. Para dúvidas, solicitações ou reclamações sobre os seus dados, use a [página de contato](/pt-br/contact) ou escreva para contact@fbrissi.dev. Como agente de tratamento de pequeno porte, o controlador está dispensado de indicar um encarregado (Resolução CD/ANPD 2/2022), e este canal cumpre essa função.

## 2. Formulário de contato

- **Dados:** o nome, o e-mail, o assunto e a mensagem que você digita no formulário em [/pt-br/contact](/pt-br/contact), e o idioma da página. O Cloudflare Turnstile verifica se o formulário foi enviado por uma pessoa antes de aceitar a mensagem; para isso, a API de contato envia o seu endereço IP à verificação do Turnstile da Cloudflare, e também usa o endereço IP para limitar o número de envios. O endereço IP não faz parte da mensagem nem é guardado com ela, mas os logs operacionais dos Workers da Cloudflare (Workers Logs) podem manter dados das requisições, inclusive o endereço IP, por até 7 dias.
- **Finalidade:** ler e responder a sua mensagem.
- **Base legal:** legítimo interesse em responder a uma mensagem que você decidiu enviar (LGPD art. 7º, IX), ou procedimentos preliminares a um contrato que você pediu, como uma vaga ou um projeto (art. 7º, V).
- **Operadores:** a Cloudflare hospeda o formulário, executa a API de contato e a sua fila, envia o e-mail e fornece o Turnstile. O Google (Gmail) hospeda a caixa de e-mail que recebe a mensagem. Veja a seção 6 sobre transferência internacional.
- **Retenção:** a mensagem fica na minha caixa de e-mail por até 12 meses e depois é apagada. A fila a remove assim que o e-mail é entregue; uma mensagem que não puder ser entregue após as novas tentativas fica em uma fila de mensagens não entregues por até 4 dias (a retenção padrão do Cloudflare Queues) e depois é descartada.
- **Compartilhamento:** a sua mensagem não é compartilhada com mais ninguém e nunca é usada para marketing.

## 3. Grupos de estudo: dados que coletamos

- **Do Google, quando você entra:** o identificador da sua conta Google, o e-mail, se o e-mail é verificado e o seu nome. Não armazenamos a sua foto de perfil.
- **Dados que você informa:** o seu nome de exibição; os grupos que você cria (nome, resumo, regras, horário, link da reunião, código de acesso); pedidos de entrada e as mensagens opcionais; participações em grupos; sugestões com notas e links; e votos.
- **Dados técnicos:** um hash do token da sua sessão, datas e horários, e os registros do seu aceite dos Termos e desta política (documento, versão e data).
- **Moderação:** quando o administrador da plataforma exclui algo, um log guarda um rótulo curto (como um título ou nome de grupo), o motivo e a data, nunca o conteúdo completo.
- **Endereço IP:** usado apenas de forma transitória pela Cloudflare para aplicar limites de requisições contra abusos. Nós não o armazenamos no banco de dados, mas os logs operacionais dos Workers da Cloudflare (Workers Logs) podem manter dados das requisições, inclusive o endereço IP, por até 7 dias.

## 4. Grupos de estudo: finalidades e bases legais

| Finalidade | Base legal (LGPD art. 7º) |
|---|---|
| Criar e manter a sua conta, grupos, participações, sugestões e votos | Execução de contrato: os Termos de Uso (V) |
| Segurança, limites de requisições, prevenção de abusos, moderação e log de auditoria | Legítimo interesse (IX) |
| Defesa de direitos em processos judiciais, administrativos ou arbitrais | Exercício regular de direitos (VI) |

O consentimento não é a base legal principal. Registramos o seu aceite dos Termos e desta política como evidência.

**Ponderação do legítimo interesse:** manter o serviço seguro para todos exige um tratamento limitado e proporcional (limites de requisições, um log de exclusões com rótulo curto e motivo). Esse tratamento é esperado pelos usuários, usa o mínimo de dados, não guarda o conteúdo e não se sobrepõe aos seus direitos.

## 5. Grupos de estudo: quem vê os seus dados

- Os membros dos seus grupos veem o seu nome de exibição, as suas sugestões e os seus votos.
- Os donos de grupos veem o nome de exibição e a mensagem opcional do seu pedido de entrada. **O seu e-mail nunca é mostrado** a membros ou donos.
- A página pública mostra apenas o nome e o resumo de cada grupo listado. O link da reunião é visível somente para os membros.
- O administrador da plataforma pode acessar qualquer grupo para moderá-lo.
- Não vendemos nem compartilhamos os seus dados com terceiros para marketing.

## 6. Operadores e transferência internacional

- **Cloudflare** hospeda o site, a API de contato e a sua fila, envia o e-mail do formulário de contato, fornece o Turnstile e, nos grupos de estudo, executa a API, armazena o banco de dados (Cloudflare D1) e aplica os limites de requisições.
- **Google** fornece o login dos grupos de estudo e hospeda a caixa de e-mail (Gmail) que recebe as mensagens do formulário de contato.

Ambos podem tratar dados fora do Brasil, inclusive nos Estados Unidos. Essas transferências se apoiam nos compromissos contratuais e nos termos de proteção de dados desses operadores (LGPD art. 33).

## 7. Grupos de estudo: retenção

- Dados da conta: até você excluir a conta.
- Sessões: 30 dias após o login. O cookie de verificação do login dura 10 minutos.
- Conteúdos e grupos excluídos: apagados definitivamente 30 dias após a exclusão.
- Pedidos de entrada já decididos: apagados 30 dias após a decisão.
- Log de moderação: 12 meses.
- Depois que você exclui a conta, as suas sugestões e votos em outros grupos permanecem anonimizados como "Former member" (ex-membro).

## 8. Seus direitos

Pelo art. 18 da LGPD, você pode solicitar: confirmação e acesso, correção, anonimização, bloqueio ou eliminação, portabilidade, informação sobre compartilhamento e revisão do uso dos seus dados. No aplicativo, você pode:

- **acessar e levar os seus dados** com "Download my data" na página da conta;
- **corrigir** o seu nome de exibição;
- **excluir** a sua conta e os seus dados.

Para qualquer outra solicitação, use a [página de contato](/pt-br/contact). Respondemos em até **15 dias**. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).

<span id="cookies"></span>

## 9. Cookies e armazenamento local

Usamos apenas cookies e armazenamento estritamente necessários. Não há cookies de analytics nem de publicidade, por isso exibimos um aviso informativo em vez de um pedido de consentimento. Se isso mudar, pediremos o seu consentimento antes.

| Nome | Tipo | Finalidade | Duração |
|---|---|---|---|
| `__Host-sg_session` | Estritamente necessário, primário, HttpOnly | Mantém você conectado | 30 dias |
| `__Host-sg_oauth` | Estritamente necessário, primário, HttpOnly | Protege o login com o Google (state, PKCE e nonce) | 10 minutos |
| `__Host-sg_signup` | Estritamente necessário, primário, HttpOnly | Guarda o seu login enquanto você aceita os Termos, antes de a conta existir | 10 minutos |
| `fbrissi.dev:preferred-locale` (armazenamento local) | Preferência | Lembra o seu idioma | Até ser apagado |
| `study-groups:cookie-notice-dismissed` (armazenamento local) | Preferência | Lembra que você fechou este aviso | Até ser apagado |
| Cloudflare Turnstile (somente na página de contato) | Segurança, definido pela Cloudflare | Proteção contra bots | Conforme a Cloudflare |

## 10. Segurança

As conexões usam HTTPS. Os cookies de sessão são HttpOnly, Secure e SameSite, e apenas um hash do token da sessão é armazenado. Cada chamada à API verifica a sua permissão, e abusos são limitados. Se um incidente de segurança puder causar risco ou dano relevante a você, comunicaremos a ANPD e as pessoas afetadas, conforme a Resolução CD/ANPD 15/2024.

## 11. Grupos de estudo: menores de idade

O programa é destinado apenas a pessoas com 18 anos ou mais. Se soubermos que uma conta pertence a um menor de idade, ela será excluída.

## 12. Alterações desta política

Cada versão desta política tem uma data. Quando uma nova versão for publicada, os membros dos grupos de estudo precisarão aceitá-la na próxima visita; até lá, você pode continuar lendo, mas não pode fazer alterações.
