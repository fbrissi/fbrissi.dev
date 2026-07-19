---
title: "Consulta de cadastros em web service utilizando certificação digital para criptografia dos dados"
description: "Trabalho de conclusão de curso de 2010 sobre uma proposta de consulta segura a cadastros centralizados por SOAP, XML e certificados digitais."
date: "2010-12-01"
image: "/images/articles/tcc-digital-certificates.svg"
imageAlt: "Dois cadastros trocando dados por um web service protegido por certificado digital"
tags:
  - Web Services
  - Certificação Digital
  - SOAP
  - Java
  - Domain-Driven Design
---

> Trabalho de conclusão do curso de Ciência da Computação da Faculdade Anhanguera de Valinhos, escrito por **Filipe Bojikian Rissi** e **Paulo Roberto Jacomini Coradi**, sob orientação do **Prof. Ms. Marcelo José Storion**, em 2010.

Este texto foi convertido do documento acadêmico original para Markdown, com correções de erros evidentes de digitação e reconhecimento de texto.

## Lista de siglas

- **NF-e:** Nota Fiscal Eletrônica
- **e-CPF:** Cadastro de Pessoa Física Eletrônico
- **e-CNPJ:** Cadastro Nacional de Pessoa Jurídica Eletrônico
- **XML:** Extensible Markup Language
- **SOAP:** Simple Object Access Protocol
- **WSDL:** Web Services Description Language
- **CNAE:** Classificação Nacional de Atividades Econômicas

## 1. Introdução

Todos os dias, ao fazer compras, ir ao médico, abrir uma conta no banco, filiar-nos a um clube ou fazer inscrições para concursos, nossas informações, como documentos, endereço e telefone, são solicitadas para que seja feito um cadastro no sistema do solicitante. Esse cadastro ficará à mercê da empresa. Não se sabe com que frequência será atualizado nem se será utilizado para fins de marketing.

Nem sempre é fácil disponibilizar as informações solicitadas no momento exato da solicitação. Às vezes é preciso apresentar os documentos originais, que não estão sempre em mãos, e o próprio estabelecimento não tem certeza da autenticidade dos documentos apresentados ou se eles foram roubados.

Com o objetivo de facilitar e trazer mais segurança a esse processo, seria essencial criar um sistema com uma base de dados centralizada contendo as informações de todo cidadão que obtém um CPF e de toda empresa que obtém um CNPJ. Dessa forma, haveria uma base com as informações de pessoas físicas e jurídicas. A pessoa jurídica teria a garantia de que as informações solicitadas são verdadeiras, enquanto a pessoa física teria maior segurança contra o uso de seus dados por quadrilhas especializadas em furto e falsificação de documentos. A pessoa física não precisaria mais apresentar seus documentos diretamente a uma pessoa jurídica: tudo seria feito por meio de um documento eletrônico seguro e intransferível.

A base de dados seria acessada apenas por um web service, a fim de garantir a segurança dos dados. Somente uma pessoa jurídica poderia solicitar informações pessoais de uma pessoa física ou de outra pessoa jurídica para realizar um cadastro ou, em alguns casos, apenas uma consulta. Entretanto, falar em uma única base de dados com informações pessoais levanta preocupações: como preservar a segurança e o sigilo? Como garantir que essas informações não sejam utilizadas com más intenções?

Para proteger as informações cadastradas, a troca de dados seria realizada por um web service. Ele receberia solicitações por meio do protocolo SOAP e confirmaria, usando certificados digitais, a autenticidade de ambas as partes: quem solicita as informações e quem é consultado. O web service validaria os certificados e verificaria quais informações poderiam ser entregues. Essa autorização seria determinada pelo CNAE da empresa solicitante: cada atividade teria acesso restrito a determinadas informações, enquanto órgãos públicos poderiam ter acesso mais amplo. A resposta também seria enviada por SOAP.

Um certificado digital é um arquivo associado a uma assinatura digital. Empresas de segurança da informação utilizam essa tecnologia para proteger dados transmitidos pela rede. O sistema emprega um par de chaves: uma chave pública, que pode ser distribuída, e uma chave privada, mantida em segredo por seu proprietário. Essas chaves permitem verificar a origem de uma assinatura e proteger informações.

Um web service é um sistema criado para permitir que outros sistemas se comuniquem, mesmo quando desenvolvidos em linguagens de programação diferentes. Isso possibilita a interoperabilidade entre plataformas. Para essa comunicação, web services podem usar XML, um formato de dados independente de linguagem.

SOAP, sigla para *Simple Object Access Protocol*, define regras para mensagens estruturadas em XML. O web service recebe um arquivo com uma solicitação e retorna outro arquivo XML, no padrão SOAP, contendo a resposta.

Na época deste trabalho, a Receita Federal já utilizava certificados digitais para solicitações de documentos on-line, envio do Imposto de Renda e outros serviços que antes exigiam o deslocamento a um órgão autorizado. A tecnologia foi empregada inicialmente na NF-e e vinha sendo adotada no e-CNPJ e no e-CPF, mas o custo da certificação digital ainda restringia seu uso.

Este projeto apresenta as vantagens de utilizar essa tecnologia. Com o interesse de pessoas físicas, pessoas jurídicas e órgãos públicos, certificados digitais poderiam tornar-se documentos essenciais. Em vez de documentos convencionais, cidadãos e empresas poderiam adotar e-CPF e e-CNPJ a preços mais acessíveis. Por meio desses documentos eletrônicos, o processo de cadastro e consulta se tornaria mais seguro e eficiente para todos.

### 1.1. Objetivos da pesquisa

Por meio de observações em estabelecimentos, conversas com pessoas que precisaram fornecer dados pessoais e experiências dos próprios autores, verificou-se uma desorganização recorrente no cadastro de dados. Fazer cadastros em lojas, sites, hospitais e clubes costuma ser um processo longo e cansativo. Quando as informações precisam estar sempre atualizadas, repeti-lo em todos os lugares torna-se ainda mais difícil.

A pesquisa, portanto, concentra-se em tornar esse processo simples e seguro. A proposta é demonstrar que o cadastro pode ser controlado em um único lugar, protegendo as informações armazenadas e sua transmissão.

#### Objetivo geral

Estudar tecnologias capazes de facilitar o processo de cadastro: web services, criptografia por certificação digital e o protocolo SOAP. O trabalho procura demonstrar como disponibilizar informações pessoais com segurança e como implementar regras de negócio no web service para impedir violações e acessos ilícitos.

#### Objetivos específicos

Entre as diversas plataformas que implementam web services, o projeto estuda uma implementação em Java, linguagem aberta e multiplataforma. Também analisa o uso do protocolo SOAP e sua adequação às regras de negócio necessárias para que informações transmitidas pela rede sejam entregues somente a pessoas autorizadas e para que cada solicitante receba apenas os dados que pode acessar.

Para isso, estuda-se a autenticação de solicitações por certificado digital. Entre as tecnologias de criptografia disponíveis, o trabalho apresenta o funcionamento da certificação digital e como ela pode comprovar que determinado arquivo foi realmente emitido por uma pessoa ou organização.

### 1.2. Justificativa

Com a proposta, o atendimento durante o cadastro de clientes poderia ser mais rápido. As informações teriam menor risco de divergência, o cliente teria segurança de que seriam registradas com precisão e a empresa teria maior confiança nos dados recolhidos. Isso seria especialmente importante para instituições financeiras ou para entregas de produtos em domicílio.

Todo cidadão poderia fornecer suas informações com mais tranquilidade, sabendo que operações como uma compra ou a abertura de uma conta bancária dependeriam do certificado digital ao qual apenas ele teria acesso.

O processo também poderia facilitar a identificação de pessoas em aeroportos, alfândegas, delegacias, bancos e outros locais nos quais uma identificação confiável seja necessária.

Se instituições financeiras adotassem a prática, a segurança dos cartões também poderia aumentar. Cartões de crédito, débito e identificação poderiam ser substituídos por um único cartão associado ao certificado, utilizado para identificar o usuário e confirmar sua senha.

### 1.3. Viabilidade

A tecnologia traz muitos benefícios à sociedade, e pessoas e empresas procuram aproveitá-los cada vez mais. Entretanto, também existem pessoas mal-intencionadas que usam esses recursos para prejudicar outras. É necessário, portanto, empregar a própria tecnologia para reduzir esses riscos.

Um sistema adotado pela Receita Federal, como ocorreu com a NF-e, traria mais segurança a empresas e cidadãos. Também facilitaria ao governo acompanhar o desenvolvimento do país, mantendo informações de cidadãos e empresas atualizadas de forma segura.

Em 2010, como o certificado não era obrigatório, sua aquisição dependia de empresas terceirizadas especializadas. Na Certisign, por exemplo, o e-CPF custava de R$ 110 a R$ 365 e o e-CNPJ de R$ 165 a R$ 465, conforme o tipo e a validade de um a três anos. O trabalho propõe que o cartão se torne obrigatório e substitua o CPF convencional, o que poderia tornar seu preço mais acessível. A segurança e a integridade proporcionadas pelo sistema tornariam o investimento viável para a Receita Federal, empresas e cidadãos.

## 2. Revisão de literatura

O Portal Nacional da Nota Fiscal Eletrônica demonstrava o sucesso do projeto da Fazenda e como ele facilitou o controle da emissão de notas fiscais. Também mostrava as possibilidades de integração por web services. O projeto não ficou limitado ao Emissor Gratuito de NF-e disponibilizado pela Receita: qualquer empresa de software poderia desenvolver um sistema capaz de se comunicar com o serviço, desde que seguisse as normas do *Manual de Integração - Contribuinte*. O tráfego era protegido por criptografia e certificação digital.

Daniel Adorno Gomes (2010) explica que, de forma genérica, web service é uma tecnologia de integração de sistemas empregada principalmente em ambientes heterogêneos. Isso significa que web services possibilitam a interação entre sistemas independentemente da linguagem de programação utilizada, por meio da troca de arquivos XML.

Ao tratar do protocolo SOAP e do WSDL, Gomes os descreve da seguinte forma:

> **SOAP (Simple Object Access Protocol):** protocolo-padrão para transmissão de dados na arquitetura de web services proposta pelo W3C. É baseado em XML e segue o modelo de requisição e resposta do HTTP.
>
> **WSDL (Web Services Description Language):** arquivo XML cuja finalidade é descrever detalhadamente um web service, especificando suas operações e definindo o formato de entrada e saída de cada uma delas.

A chamada a um web service ocorre da seguinte maneira: após o serviço ser registrado e publicado, o cliente obtém suas informações, baixa o WSDL, envia uma solicitação em XML e recebe uma resposta no mesmo formato.

Como o serviço ficaria disponível para diferentes consumidores, seria necessário implementar regras de segurança. Não bastaria responder a qualquer solicitação: seria preciso proteger os dados transmitidos e garantir que apenas pessoas autorizadas recebessem uma resposta.

Existem técnicas de criptografia para isso. Routo Terada (2008) explica que algoritmos criptográficos têm como objetivo proteger informações sigilosas contra o acesso de pessoas não autorizadas. Quem não possui a chave necessária não pode acessar a informação.

Gomes também explica que a certificação digital utiliza um conjunto distribuído de servidores de chaves públicas. Cada servidor é chamado de Autoridade Certificadora (AC). A AC administra uma base que associa uma chave pública aos atributos de seu proprietário. Cada usuário recebe um certificado digital constituído pela chave pública, pelos dados do proprietário e pela assinatura criptográfica gerada com a chave privada da AC.

## 3. Método da pesquisa

### 3.1. Uso das tecnologias no desenvolvimento do software

Não seria necessária uma pesquisa de campo para a realização das atividades. A pesquisa seria feita em laboratório, por meio de testes, e apoiada pelo estudo de revistas de tecnologia, livros e conteúdo disponível na internet. Como a linguagem escolhida para o desenvolvimento seria Java, também seria essencial consultar sua API, que documenta as classes da linguagem.

### 3.2. Abordagem para desenvolvimento de software

Para desenvolver o sistema, seria essencial utilizar técnicas e padrões de programação que organizassem a estrutura do projeto. Uma das abordagens consideradas foi o *Domain-Driven Design* (DDD), proposto por Eric Evans. Embora ainda não fosse amplamente adotado na época, o DDD reunia conceitos já aplicados no desenvolvimento de software e os concentrava na solução dos problemas do domínio de negócio, considerado por Evans o coração do software.

Sobre a contribuição de Evans, Kelly Brown afirma:

> O que Eric conseguiu captar faz parte do processo de design que designers de objetos experientes sempre utilizaram, mas que simplesmente não tivemos sucesso em transmitir para o resto do setor. Transmitimos pedaços desse conhecimento, mas nunca organizamos e sistematizamos os princípios usados na construção da lógica de domínios. Este livro é importantíssimo. (BROWN, 2009, p. i, tradução publicada na edição consultada)

Nessa abordagem, Evans enfatiza a divisão do código em camadas: interface com o usuário, aplicação, domínio e infraestrutura. A camada de domínio contém as principais regras de negócio do sistema. As camadas devem permanecer independentes e as dependências devem respeitar seus limites.

Encapsular o código dessa forma permite refatorar cada parte separadamente. Não seria necessário, por exemplo, alterar a camada de domínio para trocar o banco de dados. Isso preservaria a integridade da camada central do sistema.

**Figura 1 - Camadas da arquitetura (Evans, 2009).** O diagrama original organiza o sistema em quatro faixas, da interface com o usuário à infraestrutura, e mostra componentes das camadas superiores colaborando com a aplicação e o domínio, enquanto detalhes técnicos permanecem na infraestrutura.

## Referências

- RACHID, Jorge Antonio Deher. *Instrução Normativa SRF nº 580, de 12 de dezembro de 2005*. Receita Federal. Acesso em: 30 nov. 2010.
- ENCAT, Encontro Nacional de Coordenadores e Administradores Tributários. *Projeto Nota Fiscal Eletrônica: Manual de Integração - Contribuinte. Padrões Técnicos de Comunicação*. Acesso em: 30 nov. 2010.
- TERADA, Routo. *Segurança de Dados: Criptografia em Redes de Computadores*. 2. ed. São Paulo: Blucher, 2008. p. 18, 177.
- GOMES, Daniel Adorno. *Web Services SOAP em Java: Guia Prático para o Desenvolvimento de Web Services em Java*. 1. ed. São Paulo: Novatec, 2010. p. 13-17.
- EVANS, Eric. *Domain-Driven Design*. 1. ed. Rio de Janeiro: Alta Books, 2009. p. 63-154.
- *Revista Java Magazine*. Grajaú, RJ, ano VII, ed. 72, set. 2009, p. 70.
- *Revista Brasileira de Geografia*. Rio de Janeiro: IBGE, 1939-. Trimestral.
- DOMAIN-DRIVEN DESIGN COMMUNITY. *Navigation*. 2009. Disponível em: <http://domaindrivendesign.org>. Acesso em: 26 nov. 2010.
