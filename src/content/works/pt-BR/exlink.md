---
company: "exlink.us"
title: "Engenheiro Full Stack"
dateRange: "set de 2024 - mai de 2026"
summary: "Desenvolvimento de uma plataforma multi-tenant para intercâmbio, com mensageria, análise de sentimento por IA, renderização de documentos e assinaturas remotas."
location: "Nova York, Estados Unidos · Remoto"
employmentType: "Tempo integral"
companyUrl: "https://exlink.org/"
logo: "/images/companies/exlink.jpg"
skills: ["Laravel", "PHP", "Vue.js", "Filament", "Livewire", "Alpine.js", "Twig", "MySQL", "Docker", "Kubernetes", "AWS SNS", "Vonage API", "Arquitetura Multi-Tenant", "Agentes de IA", "Arquitetura Orientada a Eventos", "Otimização de Performance"]
startDate: "2024-09"
endDate: "2026-05"
order: 2
---

## Plataforma multi-tenant

Desenvolvi e mantive uma plataforma multi-tenant para programas de intercâmbio internacional com Laravel, Vue.js, Filament, Livewire e Alpine.js. O trabalho incluiu customizações de baixo nível em componentes server-driven do Filament e novas funcionalidades em diferentes áreas do produto.

## Performance e confiabilidade de documentos

Melhorei um sistema de templates baseado em Twig criando cache para placeholders gerados, reduzindo significativamente o tempo de carregamento. Também diagnostiquei timeouts causados por relações circulares durante o mapeamento recursivo e alterei o algoritmo para detectar e limitar ciclos, eliminando loops infinitos e estabilizando a geração de documentos.

## Mensageria e análise por IA

Projetei um sistema interno de mensagens para comunicação entre equipes na plataforma. A solução suportava respostas bidirecionais por e-mail via AWS SNS, SMS pela API da Vonage, processamento em background e um agente de IA que analisava conversas e gerava métricas de sentimento.

Diante de um prazo curto e uma dependência open source sem flexibilidade suficiente, criei e adaptei um fork do pacote. Isso desbloqueou a entrega e permitiu devolver melhorias ao projeto enquanto a contribuição oficial estava em análise.

## Assinatura remota para múltiplos participantes

Projetei e implementei todo o fluxo de assinatura: geração de documentos por APIs, templates de assinatura, gerenciamento do ciclo de vida, acompanhamento do progresso, atualização de status, documentos assinados, logs de auditoria e notificações. A solução aumentou a segurança, rastreabilidade e confiabilidade do processo remoto.
