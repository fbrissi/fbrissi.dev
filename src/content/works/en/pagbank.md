---
company: "PagBank PagSeguro"
title: "Senior Software Engineer"
dateRange: "Aug 2021 - Sep 2024"
summary: "Engineered regulated Open Finance authentication, payment microservices, AWS infrastructure, and shared delivery pipelines serving more than 20 teams."
location: "São Paulo, SP, Brazil · Remote"
employmentType: "Indirect contract"
companyUrl: "https://pagbank.com.br/"
logo: "/images/companies/pagbank.jpg"
skills: ["Java", "Keycloak", "Quarkus", "FIDO", "Open Finance", "AWS", "Terraform", "Atlantis", "Docker", "Jenkins", "Amazon ECS", "AWS Lambda", "MTLS", "Infinispan", "Oracle", "Splunk", "Microservices", "CI/CD"]
startDate: "2021-08"
endDate: "2024-09"
order: 3
---

## Open Finance identity platform

I developed and maintained authentication and authorization APIs for Brazil's Open Finance ecosystem, customizing Keycloak to satisfy Central Bank specifications and regulatory requirements. I redesigned the local environment with multi-stage Docker builds that automatically applied internal customizations, integrated mock APIs, and matched the production database structure. This standardized development and substantially reduced onboarding time.

I helped migrate the customized identity server from JBoss/WildFly to Quarkus, resolving differences in extension loading, dependencies, and classloader behavior. I also fixed an Infinispan cache issue affecting Oracle compatibility, customized the Keycloak UI, and integrated a certified open-source FIDO solution into the authentication flow under a short regulatory deadline.

## Payments and cloud infrastructure

I maintained a payment ecosystem composed of microservices and cloud-native components, including MTLS services and infrastructure managed with Terraform and Atlantis. The AWS estate included Lambda, CloudWatch Logs, S3, VPC, IAM, Secrets Manager, load balancers, API Gateway, Route 53, DynamoDB, ECR, and ECS.

## Delivery and performance

I enhanced a shared Jenkins deployment pipeline used by more than 20 teams, adding ECS deployment behavior for Splunk logging while maintaining backward compatibility and requiring no changes from consuming teams.

I also reduced authorization latency in a token-introspection Lambda by running independent validation steps concurrently instead of sequentially, improving response times without changing validation behavior.
