---
company: "exlink.us"
title: "Full Stack Engineer"
dateRange: "Sep 2024 - May 2026"
summary: "Built multi-tenant exchange-program workflows, messaging, AI sentiment analysis, document rendering, and secure multi-party e-signatures with Laravel and Vue.js."
location: "New York, NY, United States · Remote"
employmentType: "Full-time"
companyUrl: "https://exlink.org/"
logo: "/images/companies/exlink.jpg"
skills: ["Laravel", "PHP", "Vue.js", "Filament", "Livewire", "Alpine.js", "Twig", "MySQL", "Docker", "Kubernetes", "AWS SNS", "Vonage API", "Multi-Tenant Architecture", "AI Agents", "Event-Driven Architecture", "Performance Optimization"]
startDate: "2024-09"
endDate: "2026-05"
order: 2
---

## Multi-tenant platform development

I developed and maintained a multi-tenant platform for international exchange programs using Laravel, Vue.js, Filament, Livewire, and Alpine.js. The work included low-level customization of server-driven Filament components and new product features across the platform.

## Document rendering performance and reliability

I improved a Twig-powered document template system by caching generated placeholders, significantly reducing slow load times. I also diagnosed timeouts caused by circular object relationships during recursive placeholder mapping and changed the algorithm to detect and limit cycles, preventing infinite loops and stabilizing document generation.

## Messaging and AI analysis

I designed an internal messaging system that enabled communication among teams throughout the platform. It supported bidirectional email replies through AWS SNS, SMS through the Vonage API, background processing, and an AI agent that analyzed conversations and generated sentiment metrics.

A key dependency was not flexible enough for the required customizations under a tight deadline. I forked and adapted the open-source package, unblocking delivery while contributing improvements upstream during the official review process.

## Multi-party document signing

I designed and implemented the complete remote signing workflow for multiple participants: generating documents through APIs, creating signature templates, managing every lifecycle step, tracking progress, updating statuses, producing signed documents and audit logs, and notifying users. The result improved the security, traceability, and reliability of remote signatures.
