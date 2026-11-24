---
title: Política de Privacidade
description: Como o fbrissi.dev, o formulário de contato e o programa de grupos de estudo de inglês coletam, usam e protegem dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD).
version: '2026-11-27'
---

Esta política explica como o `fbrissi.dev` trata dados pessoais conforme a Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018, "LGPD"): o formulário de contato (seção 2) e o programa de grupos de estudo de inglês em `fbrissi.dev/study-groups` (seções 3 a 5, 7 e 11); a seção 6 vale para os dois e para o monitoramento de erros de todo o site. Navegar pelo restante do site não exige nenhum dado pessoal. Para usuários no Brasil, esta versão em português prevalece sobre a [versão em inglês](/privacy).

## 1. Controlador e contato

O controlador é **Filipe Bojikian Rissi**, pessoa física residente no Brasil. Para dúvidas, solicitações ou reclamações sobre os seus dados, use a [página de contato](/pt-br/contact) ou escreva para contact@fbrissi.dev. Para o programa de grupos de estudo de inglês (dúvidas sobre o programa, denúncias de abuso e solicitações sobre os seus dados nos grupos de estudo), escreva para **groups@fbrissi.dev**. Como agente de tratamento de pequeno porte, o controlador está dispensado de indicar um encarregado (Resolução CD/ANPD 2/2022), e este canal cumpre essa função.

## 2. Formulário de contato

- **Dados:** o nome, o e-mail, o assunto e a mensagem que você digita no formulário em [/pt-br/contact](/pt-br/contact), e o idioma da página. Se você escrever direto para contact@fbrissi.dev ou contato@fbrissi.dev, vale o mesmo para o seu endereço de e-mail, a mensagem, os anexos e os cabeçalhos comuns de e-mail. O Cloudflare Turnstile verifica se o formulário foi enviado por uma pessoa antes de aceitar a mensagem; para isso, o Turnstile processa sinais do seu navegador e do seu dispositivo, e a API de contato envia o seu endereço IP à verificação do Turnstile da Cloudflare, e também usa o endereço IP para limitar o número de envios. O endereço IP não faz parte da mensagem nem é guardado com ela, mas os logs operacionais dos Workers da Cloudflare (Workers Logs) podem manter dados das requisições, inclusive o endereço IP, por até 7 dias.
- **Finalidade:** ler e responder a sua mensagem.
- **Base legal:** legítimo interesse em responder a uma mensagem que você escolheu enviar (LGPD art. 7º, IX), ou os procedimentos preliminares de um contrato que você pediu, como uma vaga ou um projeto (art. 7º, V). Um pedido sobre os seus dados pessoais é respondido para cumprir a minha obrigação legal (art. 7º, II).
- **Quem trata:** a Cloudflare hospeda o formulário, executa a API de contato e a sua fila, envia o e-mail, fornece o Turnstile e, pelo Cloudflare Email Routing, encaminha os e-mails enviados direto para contact@fbrissi.dev e contato@fbrissi.dev. A caixa que recebe a mensagem é uma conta pessoal do Gmail; o Google fornece o Gmail conforme os seus próprios termos e a sua [política de privacidade](https://policies.google.com/privacy?hl=pt-BR). Quando eu respondo, a resposta é enviada de contact@fbrissi.dev pelo Amazon Simple Email Service (Amazon SES, da Amazon Web Services), que recebe o seu endereço de e-mail e a minha resposta, inclusive qualquer trecho citado da sua mensagem. Veja a seção 6 sobre transferência internacional.
- **Retenção:** a mensagem, venha ela do formulário ou de um e-mail direto, fica na minha caixa de e-mail por até 12 meses e depois é apagada. A fila a remove assim que o e-mail é entregue; uma mensagem que não puder ser entregue após as novas tentativas fica em uma fila de mensagens não entregues por até 24 horas (a retenção fixa do Cloudflare Queues no plano Workers Free) e depois é descartada.
- **Compartilhamento:** a sua mensagem não é compartilhada com mais ninguém e nunca é usada para marketing.

## 3. Grupos de estudo: dados que coletamos

- **Do Google, quando você entra:** o identificador da sua conta Google, o e-mail, se o e-mail é verificado e o seu nome. O Google trata o login conforme a sua própria [política de privacidade](https://policies.google.com/privacy?hl=pt-BR). Não armazenamos a sua foto de perfil.
- **Dados que você informa:** o seu nome de exibição; os grupos que você cria (nome, resumo, regras, horário, link da reunião, código de acesso e ícone); pedidos de entrada e as mensagens opcionais; participações em grupos; sugestões com notas e links; e votos.
- **Ícones dos grupos:** a imagem que o dono envia (PNG, JPEG ou WebP, de até 256 KB e 512 × 512 pixels), armazenada de forma privada no Cloudflare R2. Antes de ser armazenada, os seus metadados (como o EXIF, que pode incluir o local e a hora em que a foto foi tirada, e XMP, IPTC, comentários e blocos de texto) são removidos. Também contamos os envios por usuário e por grupo (usuário, grupo e data) para limitar abusos.
- **Dados técnicos:** um hash do token da sua sessão, datas e horários, e os registros do seu aceite dos Termos e desta política (documento, versão e data).
- **Moderação:** quando o administrador da plataforma exclui algo, remove um ícone, ou bane uma conta, renova ou desfaz um banimento, um log guarda um rótulo curto (como um título, nome de grupo ou nome de exibição), o motivo e a data, nunca o conteúdo completo.
- **Banimentos:** para uma conta banida, um registro de banimento com a conta, o identificador da conta Google, o e-mail, o motivo, o administrador que a baniu, a data e a data em que ele expira.
- **E-mails de serviço:** a sua configuração de e-mail (ligada ou desligada) e, para cada e-mail de serviço, um registro com o tipo, o grupo, o nome dele e, numa exclusão pelo administrador, o motivo, além do status e das datas. O registro nunca guarda o seu endereço de e-mail, o nome de quem pediu para entrar nem a mensagem do pedido; o endereço é lido da sua conta somente no momento do envio.
- **Endereço IP:** usado apenas de forma transitória pela Cloudflare para aplicar limites de requisições contra abusos. Nós não o armazenamos no banco de dados, mas os logs operacionais dos Workers da Cloudflare (Workers Logs) podem manter dados das requisições, inclusive o endereço IP, por até 7 dias.

## 4. Grupos de estudo: finalidades e bases legais

| Finalidade | Base legal (LGPD art. 7º) |
|---|---|
| Criar e manter a sua conta, grupos (inclusive os ícones), participações, sugestões e votos | Execução de contrato: os Termos de Uso (V) |
| Enviar e-mails de serviço sobre os pedidos de entrada nos seus grupos, a decisão sobre os seus próprios pedidos, os encontros dos seus grupos, a exclusão do seu grupo ou do ícone dele pelo administrador da plataforma e o banimento da sua conta ou o fim dele | Execução de contrato: os Termos de Uso (V) |
| Segurança, limites de requisições, prevenção de abusos, moderação, banimentos e log de auditoria | Legítimo interesse (IX) |
| Encontrar e corrigir erros no site, no formulário de contato e no programa (monitoramento de erros com o Sentry, seção 6) | Legítimo interesse (IX) |
| Defesa de direitos em processos judiciais, administrativos ou arbitrais | Exercício regular de direitos (VI) |

O consentimento não é a base legal principal. Registramos o seu aceite dos Termos e desta política como evidência.

**E-mails de serviço:** enviamos apenas e-mails sobre o seu uso do programa, nunca marketing: para o dono de um grupo, no máximo um e-mail por grupo a cada 6 horas dizendo quantos pedidos de entrada estão aguardando (sem o nome nem a mensagem de quem pediu); para quem pediu, se o pedido foi aprovado ou não; para o dono, quando o administrador da plataforma exclui o grupo ou remove o ícone dele, com o motivo; e para o dono e os membros de um grupo, um lembrete de cada encontro na véspera (24 horas antes) e no dia (2 horas antes), com o horário e o link do encontro, a menos que o dono tenha desligado os lembretes do grupo. Eles vêm ligados por padrão. Se a sua conta for banida, você recebe um e-mail avisando, com o motivo e como contestar, e, quando o banimento for desfeito, um e-mail curto avisando que a sua conta foi restaurada. Os dois são enviados mesmo que você tenha desligado os e-mails de serviço, porque uma conta banida não pode entrar para ver nada no aplicativo. Você pode desligá-los a qualquer momento na página da conta ou pelo link de cancelamento com um clique presente em todo e-mail; você continua vendo tudo no aplicativo. Depois que um pedido não é aprovado, você pode pedir para entrar no mesmo grupo de novo após 7 dias.

**Ponderação do legítimo interesse:** manter o serviço seguro para todos exige um tratamento limitado e proporcional (limites de requisições, um log de moderação com rótulo curto e motivo e, para uma conta banida por violar a política de conteúdo, um registro de banimento que impede a mesma conta Google ou o mesmo e-mail de se cadastrar de novo). Esse tratamento é esperado pelos usuários, usa o mínimo de dados, não guarda o conteúdo e não se sobrepõe aos seus direitos.

## 5. Grupos de estudo: quem vê os seus dados

- Os membros dos seus grupos veem o seu nome de exibição, as suas sugestões e os seus votos, e o ícone do grupo. Qualquer pessoa conectada que abrir o link de entrada de um grupo vê o nome, o resumo, o ícone, o dia e o horário da reunião semanal dele, e se ele exige código de acesso.
- Os donos de grupos veem o nome de exibição e a mensagem opcional do seu pedido de entrada. Eles são avisados por e-mail de que há pedidos aguardando, sem o seu nome, a sua mensagem ou o seu e-mail. **O seu e-mail nunca é mostrado** a membros ou donos.
- A página pública do programa mostra o nome, o resumo, o ícone, o dia e o horário da reunião semanal de cada grupo listado, e se ele exige código de acesso. Grupos não listados, e os seus ícones, nunca aparecem nela. O link da reunião é visível somente para os membros. Os ícones são servidos por links assinados que expiram em até 2 horas; até lá, quem tiver o link pode abrir o ícone.
- Enquanto uma conta está banida, as suas sugestões, votos, participações e pedidos de entrada ficam ocultos para os outros usuários.
- O administrador da plataforma pode acessar qualquer grupo para moderá-lo.
- Não vendemos nem compartilhamos os seus dados com terceiros para marketing.

<span id="international-transfer"></span>

## 6. Fornecedores e transferência internacional

- **Cloudflare** hospeda o site, a API de contato e a sua fila, envia o e-mail do formulário de contato, encaminha os e-mails enviados para contact@fbrissi.dev, contato@fbrissi.dev e groups@fbrissi.dev (Email Routing), fornece o Turnstile e, nos grupos de estudo, executa a API, armazena o banco de dados (Cloudflare D1) e os ícones dos grupos (Cloudflare R2) e aplica os limites de requisições.
- **Amazon Web Services (Amazon SES)** envia os e-mails de serviço dos grupos de estudo, de notifications@fbrissi.dev com respostas para groups@fbrissi.dev, e as minhas respostas enviadas como contact@fbrissi.dev. Ela recebe o endereço de e-mail do destinatário, o assunto e o corpo do e-mail e metadados de envio. Se um e-mail voltar ou o destinatário marcá-lo como spam, o Amazon SES pode incluir o endereço na lista de supressão da conta, o que impede novos envios para ele.
- **Sentry (Functional Software, Inc.)** recebe relatórios de erro do site, do formulário de contato e da API dos grupos de estudo, para que as falhas possam ser encontradas e corrigidas (legítimo interesse). Um relatório contém a mensagem de erro e o ponto do código em que ele ocorreu, o caminho da página ou da API sem os parâmetros da URL, o navegador e o sistema operacional, o horário e a versão do site. Ele nunca contém o seu nome, endereço de e-mail, cookies, campos de formulário, mensagens ou o conteúdo das requisições, e endereços de e-mail dentro das mensagens de erro são removidos antes do envio. O Sentry recebe o endereço IP da conexão que envia o relatório, e o configuramos para não armazená-lo. Os relatórios são mantidos por até 90 dias.
- **Google** fornece a conta pessoal do Gmail que recebe as mensagens de contato, conforme os seus próprios termos e a sua [política de privacidade](https://policies.google.com/privacy?hl=pt-BR), e trata o login dos grupos de estudo conforme a sua própria política de privacidade.

Alguns desses fornecedores armazenam ou tratam dados fora do Brasil, inclusive nos Estados Unidos. Nesses casos, os dados são transferidos com base nos compromissos contratuais desses fornecedores de protegê-los e nas garantias admitidas pelo art. 33 da LGPD. Cada fornecedor recebe apenas os dados necessários para o seu serviço. Você pode pedir mais informações sobre essas transferências pela [página de contato](/pt-br/contact).

## 7. Grupos de estudo: retenção

- Dados da conta: até você excluir a conta.
- Sessões: 30 dias após o login. O cookie de verificação do login dura 10 minutos.
- Excluir é definitivo e imediato: uma sugestão excluída, um ícone removido ou um grupo excluído (com o acesso dos membros, os pedidos de entrada, as sugestões, os votos, as rodadas e o ícone) é apagado na hora e não pode ser restaurado por você nem por nós. Os dados excluídos podem permanecer na recuperação pontual do banco de dados (Cloudflare D1 Time Travel) por até 7 dias antes de desaparecerem, e um ícone que um navegador já carregou pode continuar aparecendo nesse navegador até o link dele expirar (no máximo 2 horas).
- Ícones dos grupos: até o dono substituir ou remover o ícone, o grupo ser excluído ou o dono excluir a conta. Contadores de envio de ícones: 1 dia.
- Pedidos de entrada já decididos: apagados 30 dias após a decisão.
- Log de moderação, inclusive banimentos, renovações e desbanimentos: 12 meses.
- Registros de banimento: enquanto o banimento durar, por no máximo 2 anos a partir do banimento ou da última renovação. Desfazer o banimento, ou o fim desses 2 anos, apaga o registro, e a conta pode ser usada de novo. Enquanto uma conta está banida, os seus dados são mantidos e ficam ocultos para os outros usuários.
- Configuração de e-mail: até você excluir a conta.
- Relatórios de erro no Sentry (todo o site): até 90 dias.
- Registros dos e-mails de serviço (a fila de saída e o log de envio): 30 dias após a criação de cada e-mail. A fila que entrega o e-mail ao serviço de envio guarda apenas o número do registro; um e-mail que não puder ser enviado após as novas tentativas fica em uma fila de mensagens não entregues por até 24 horas. O Amazon SES mantém os seus próprios registros de envio conforme os termos da AWS.
- Depois que você exclui a conta, as suas sugestões e votos em outros grupos permanecem anonimizados como "Former member" (ex-membro).

## 8. Seus direitos

Pelo art. 18 da LGPD, você pode solicitar: confirmação e acesso, correção, anonimização, bloqueio ou eliminação, portabilidade, informação sobre compartilhamento e revisão do uso dos seus dados. No aplicativo, você pode:

- **acessar e levar os seus dados** com "Download my data" na página da conta, inclusive os ícones dos grupos dos quais você é dono;
- **corrigir** o seu nome de exibição;
- **desligar ou ligar os e-mails de serviço** na página da conta, ou desligá-los pelo link de cancelamento em qualquer e-mail;
- **excluir** a sua conta e os seus dados.

Se a sua conta estiver banida, você não consegue entrar para usar essas ferramentas: peça uma cópia ou a exclusão dos seus dados pelo e-mail groups@fbrissi.dev. Para qualquer outra solicitação sobre os seus dados nos grupos de estudo, escreva para groups@fbrissi.dev; para o formulário de contato, use a [página de contato](/pt-br/contact). Respondemos em até **15 dias**. Como agente de tratamento de pequeno porte, posso usar os prazos diferenciados da Resolução CD/ANPD 2/2022 (arts. 14 e 15), mas procuro responder bem antes. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).

<span id="cookies"></span>

## 9. Cookies e armazenamento local

Usamos apenas cookies e armazenamento estritamente necessários. Não há cookies de analytics nem de publicidade, por isso exibimos um aviso informativo em vez de um pedido de consentimento. Se isso mudar, pediremos o seu consentimento antes. O relato de erros (Sentry, seção 6) não define cookies nem guarda nada no seu navegador.

| Nome | Tipo | Finalidade | Duração |
|---|---|---|---|
| `__Host-sg_session` | Estritamente necessário, primário, HttpOnly | Mantém você conectado | 30 dias |
| `__Host-sg_oauth` | Estritamente necessário, primário, HttpOnly | Protege o login com o Google (state, PKCE e nonce) | 10 minutos |
| `__Host-sg_signup` | Estritamente necessário, primário, HttpOnly | Guarda o seu login enquanto você aceita os Termos, antes de a conta existir | 10 minutos |
| `fbrissi.dev:preferred-locale` (armazenamento local) | Preferência | Lembra o seu idioma | Até ser apagado |
| `study-groups:cookie-notice-dismissed` (armazenamento local) | Preferência | Lembra que você fechou este aviso | Até ser apagado |
| Cloudflare Turnstile (somente na página de contato) | Segurança, definido pela Cloudflare | Proteção contra bots | Conforme a Cloudflare |

## 10. Segurança

As conexões usam HTTPS. Os cookies de sessão são HttpOnly, Secure e SameSite, e apenas um hash do token da sessão é armazenado. Cada chamada à API verifica a sua permissão, e abusos são limitados. Os ícones dos grupos ficam num repositório privado e são servidos apenas por links assinados que expiram em até 2 horas. Se um incidente de segurança puder causar risco ou dano relevante a você, comunicaremos a ANPD e as pessoas afetadas, conforme a Resolução CD/ANPD 15/2024.

## 11. Grupos de estudo: menores de idade

O programa é destinado apenas a pessoas com 18 anos ou mais. Se soubermos que uma conta pertence a um menor de idade, ela será excluída.

## 12. Alterações desta política

Cada versão desta política tem uma data. Quando uma versão mudar a política de forma relevante (novos operadores, finalidades, bases legais ou transferências), os membros dos grupos de estudo precisarão aceitá-la na próxima visita; até lá, você pode continuar lendo, mas não pode fazer alterações. Outras mudanças, como esclarecimentos, valem a partir da publicação, com uma nova data.
