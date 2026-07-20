---
company: "PagBank PagSeguro"
title: "Engenheiro de Software Sênior"
dateRange: "ago de 2021 - set de 2024"
summary: "Engenharia de autenticação para Open Finance, microsserviços de pagamentos, infraestrutura AWS e pipelines compartilhados por mais de 20 equipes."
location: "São Paulo, SP · Remoto"
employmentType: "Contrato indireto"
companyUrl: "https://pagbank.com.br/"
logo: "/images/companies/pagbank.jpg"
skills: ["Java", "Keycloak", "Quarkus", "FIDO", "Open Finance", "AWS", "Terraform", "Atlantis", "Docker", "Jenkins", "Amazon ECS", "AWS Lambda", "MTLS", "Infinispan", "Oracle", "Splunk", "Microsserviços", "CI/CD"]
startDate: "2021-08"
endDate: "2024-09"
order: 3
---

## Identidade no Open Finance

Desenvolvi e mantive APIs de autenticação e autorização para o ecossistema brasileiro de Open Finance, customizando o Keycloak para atender especificações do Banco Central e requisitos regulatórios. Redesenhei o ambiente local com builds Docker multi-stage que aplicavam automaticamente as customizações internas, integravam APIs mock e reproduziam a estrutura do banco de produção. Isso padronizou o desenvolvimento e reduziu substancialmente o tempo de onboarding.

Ajudei a migrar o servidor de identidade customizado de JBoss/WildFly para Quarkus, resolvendo diferenças no carregamento de extensões, dependências e classloaders. Também corrigi um problema do cache Infinispan com Oracle, customizei a interface do Keycloak e integrei uma solução FIDO open source certificada dentro de um prazo regulatório curto.

## Pagamentos e infraestrutura cloud

Mantive um ecossistema de pagamentos composto por microsserviços e componentes cloud-native, incluindo serviços MTLS e infraestrutura gerenciada com Terraform e Atlantis. O ambiente AWS usava Lambda, CloudWatch Logs, S3, VPC, IAM, Secrets Manager, Load Balancer, API Gateway, Route 53, DynamoDB, ECR e ECS.

## Entrega e performance

Evoluí um pipeline Jenkins compartilhado por mais de 20 equipes, adicionando ao deploy no ECS o suporte aos requisitos de logging do Splunk, mantendo retrocompatibilidade e sem exigir mudanças dos times consumidores.

Também reduzi a latência de autorização em uma Lambda de introspecção de tokens ao executar em paralelo validações independentes que antes eram sequenciais, preservando o comportamento funcional.
