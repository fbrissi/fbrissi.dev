---
title: "Nota Profile"
description: "A product for issuing Brazilian service invoices (NFS-e Nacional) for accounting firms, MEIs and service providers: set up each company once, then issue every month, one invoice at a time or in batches."
url: "https://notaprofile.com.br/?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=project-page-en"
stack:
  - SaaS
  - NFS-e Nacional
  - A1 digital certificates
  - Recurring billing
order: 1
---

Nota Profile is a product of Oliblish, my company, built and launched by me: a web platform that issues service invoices (NFS-e) through Brazil's national standard, the NFS-e Nacional. It serves accounting firms that handle many client companies, and MEIs and self-employed professionals who issue their own invoices. The product is in Portuguese and built for the Brazilian tax system.

[Create your free account](https://app.notaprofile.com.br/cadastro?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=project-page-en) or [visit notaprofile.com.br](https://notaprofile.com.br/?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=project-page-en).

## The problem

Since the November 2026 tax period, MEI and Simples Nacional ME/EPP companies must issue NFS-e under the national standard. Most invoices a service business issues repeat every month: same client, same service, similar amounts. Nota Profile stores that repetition as templates, so each month's work is reviewing what changed and issuing.

## How it works

1. **Register the company and upload its A1 certificate.** With the certificate, Nota Profile queries the NFS-e Nacional and sets up invoice numbering on its own. The `.pfx` file and its password are stored encrypted.
2. **Pick a tax profile.** There are ready-made profiles for doctors, developers, accountants and other activities, or you create your own.
3. **Create a preset for each client.** A preset is the invoice template: service, client and amounts. Before it can be used, it is issued in the national test environment (homologação, with no fiscal effect), and you download the DANFSE to check it.
4. **Issue.** On the scheduled day the invoice goes out on its own or waits for you to review the amount and description. One-off invoices and batch issuing work from the same presets.

## For accounting firms

- one account with many client companies, each with its own certificate, profiles and presets
- invited team members with their own roles and permissions, who only see the workspaces they were invited to
- at month-end close, filter the pending recurrences, adjust only what changed and issue the batch

## For services sold abroad

Developers, designers and consultants who bill foreign clients get a commercial invoice in English, as a PDF in the contract currency, generated with the export NFS-e every period. The invoice is emailed separately to the recipients you choose, and it can also be issued on its own.

## Checks before and after each invoice

- numbering is tracked per company and a used number is never reused; a separate series lets the company keep another issuer running in parallel
- when the NFS-e Nacional rejects an invoice, you see a summary of the problem next to the original message and code
- after authorization, the client receives the DANFSE and XML by email, and replacements and cancellations are announced too
- authorized invoices can be replaced or cancelled, including cancellation in batches

Nota Profile computes the arithmetic the official layout defines, such as ISS, PIS/COFINS and the net amount. Rates, tax bases, withholdings and tax classification are set by whoever issues the invoice, or by their accountant.

## Status

Nota Profile is in beta and already issuing real invoices in production. Every plan is free during the beta with the coupon shown on its card, and sign-up needs no credit card. Plans and post-beta prices are on the [pricing section](https://notaprofile.com.br/?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=project-page-en#planos).

## Stack

A multi-company web application integrated with the NFS-e Nacional and with email delivery.

## Skills demonstrated

- **Product:** taking a product from idea to launch, with onboarding, pricing, a public beta and a support channel
- **Domain modeling:** Brazilian tax documents, tax profiles, invoice numbering series, replacements and cancellations
- **Integration:** a government API authenticated with the company's digital certificate, with test and production environments
- **Automation:** recurring and batch issuing, with an optional human review step
- **Multi-tenancy:** workspaces, invited users, roles and permissions
