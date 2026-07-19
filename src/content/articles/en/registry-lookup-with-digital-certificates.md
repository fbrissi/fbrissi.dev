---
title: "Registry lookup via web service using digital certificates for data encryption"
description: "A 2010 computer science thesis proposing secure access to centralized records through SOAP, XML, and digital certificates."
date: "2010-12-01"
image: "/images/articles/tcc-digital-certificates.svg"
imageAlt: "Two registries exchanging data through a web service protected by a digital certificate"
tags:
  - Web Services
  - Digital Certificates
  - SOAP
  - Java
  - Domain-Driven Design
---

> Computer Science final-year thesis presented at Faculdade Anhanguera de Valinhos, written by **Filipe Bojikian Rissi** and **Paulo Roberto Jacomini Coradi**, and supervised by **Prof. Marcelo José Storion, MSc**, in 2010.

This text was translated from the original Portuguese academic paper and converted to Markdown. Obvious typographical and text-recognition errors were corrected while preserving the paper's original context and proposals.

## Abbreviations

- **NF-e:** Electronic Invoice (*Nota Fiscal Eletrônica*)
- **e-CPF:** Electronic Individual Taxpayer Registry
- **e-CNPJ:** Electronic Corporate Taxpayer Registry
- **XML:** Extensible Markup Language
- **SOAP:** Simple Object Access Protocol
- **WSDL:** Web Services Description Language
- **CNAE:** National Classification of Economic Activities

## 1. Introduction

Every day, when shopping, visiting a doctor, opening a bank account, joining a club, or applying for an examination, we are asked for personal information such as identity documents, addresses, and telephone numbers. This information is entered into the requesting organization's system and placed under its control. We do not know how often it will be updated or whether it will be used for marketing.

Providing the requested information at the exact time it is needed is not always easy. Original documents may be required, and people do not carry all of them at all times. The establishment itself cannot always be certain that the documents are authentic or have not been stolen.

To simplify this registration process and make it more secure, a system could maintain a centralized database containing information about every citizen who obtains a CPF and every company that obtains a CNPJ. Such a database would contain records for both individuals and legal entities. A company could trust that the requested information was authentic, while an individual would gain protection against groups specializing in document theft and forgery. Instead of presenting documents directly to a company, the individual would use a secure, non-transferable electronic document.

The database would be accessible only through a web service to protect its data. A legal entity could request personal information about an individual or another legal entity for registration or, in some cases, a lookup. However, the idea of a single database containing personal information raises immediate concerns: how could security and confidentiality be maintained? How could misuse be prevented?

To protect registered information, all data exchange would take place through a web service. Requests would use SOAP, and digital certificates would confirm the authenticity of both the requester and the subject of the lookup. The web service would validate each certificate and determine which information the requester was authorized to receive. Authorization would be based on the requesting company's CNAE classification: each business activity would receive restricted access to specific information, while government agencies could have broader access. Responses would also be sent through SOAP.

A digital certificate is a file associated with a digital signature. Information security companies use this technology to protect data transmitted over networks. The system uses a key pair: a public key that may be distributed and a private key kept secret by its owner. Together, these keys make it possible to verify the origin of a signature and protect information.

A web service allows systems to communicate even when they were built with different programming languages. It enables interoperability across platforms. Web services can exchange XML, a language-independent data format, for this purpose.

SOAP, or *Simple Object Access Protocol*, defines rules for messages structured as XML. A web service receives an XML request and returns an XML response following the SOAP standard.

At the time of this paper, Brazil's Federal Revenue Service already used digital certificates for online document requests, income tax returns, and other services that had previously required a visit to an authorized office. The technology was initially used for NF-e electronic invoices and was being adopted for e-CNPJ and e-CPF credentials, although the cost of digital certificates still limited adoption.

This project presents the benefits of using this technology. Interest from individuals, companies, and government agencies could make digital certificates essential documents. Citizens and companies could adopt e-CPF and e-CNPJ credentials instead of conventional documents at a more accessible price. These electronic documents would make registration and record lookup safer and more efficient for everyone.

### 1.1. Research objectives

Observations at establishments, conversations with people who had been required to provide personal data, and the authors' own experiences showed recurring disorganization in personal-data registration. Registering at a store, website, hospital, or club is often a long and tiring process. When information must remain current, repeating the process everywhere becomes even more difficult.

The research therefore focuses on making this process simple and secure. It aims to show that records can be controlled in one place while protecting both stored information and its transmission.

#### General objective

Study technologies that could simplify registration: web services, encryption through digital certification, and SOAP. The paper aims to demonstrate how personal information could be made available securely and how business rules in the web service could prevent system breaches and unlawful access.

#### Specific objectives

Among the platforms that implement web services, the project studies an implementation in Java, an open and cross-platform language. It also examines SOAP and how it could support the business rules required to transmit information only to authorized parties and ensure that each requester receives only the data they are permitted to access.

For this purpose, the paper studies request authentication through digital certificates. Among the available encryption technologies, it describes digital certification and how it can establish that a file was issued by a particular person or organization.

### 1.2. Rationale

The proposal could make customer registration faster. Information would be less likely to diverge across systems, customers could trust that their details were recorded accurately, and companies could have greater confidence in the data they collected. This would be particularly valuable for financial institutions and home deliveries.

Citizens could provide information with greater confidence, knowing that transactions such as purchases or opening a bank account would depend on a digital certificate that only they could access.

The process could also simplify identification at airports, customs offices, police stations, banks, and other places where reliable identification is necessary.

If financial institutions adopted this practice, card security could also improve. Credit, debit, and customer identification cards could be replaced by a single certificate-enabled card used to identify the customer and confirm a password.

### 1.3. Feasibility

Technology provides many benefits to society, and people and organizations increasingly seek to use them. However, malicious actors also use these resources to harm others. Technology itself must therefore be applied to reduce those risks.

A system adopted by the Federal Revenue Service, as NF-e had been, would bring greater security to companies and citizens. It could also help the government monitor the country's development while keeping information about citizens and companies securely up to date.

In 2010, because digital certificates were not mandatory, they had to be purchased from specialized third-party companies. At Certisign, for example, e-CPF credentials cost between R$110 and R$365, while e-CNPJ credentials cost between R$165 and R$465, depending on their type and one-to-three-year validity. The paper proposes making the card mandatory and replacing the conventional CPF, which could make it more affordable. The security and data integrity provided by the system would make the investment feasible for the Federal Revenue Service, companies, and citizens.

## 2. Literature review

Brazil's National Electronic Invoice Portal demonstrated the success of the Finance Department's project and how it simplified invoice issuance controls. It also showed the integration possibilities offered by web services. The project was not restricted to the free NF-e issuer supplied by the Revenue Service: any software company could develop a system capable of communicating with the service by following the standards in the *Taxpayer Integration Manual*. Traffic was protected using encryption and digital certification.

Daniel Adorno Gomes (2010) explains that a web service is, in general terms, a systems-integration technology used primarily in heterogeneous environments. Web services therefore enable systems to interact regardless of the programming language used, through the exchange of XML files.

When discussing SOAP and WSDL, Gomes describes them as follows:

> **SOAP (Simple Object Access Protocol):** the standard protocol for transmitting data within the web service architecture proposed by the W3C. It is based on XML and follows HTTP's request-response model.
>
> **WSDL (Web Services Description Language):** an XML file that describes a web service in detail, specifies its operations, and clearly defines the input and output format of each operation.

A web service is called as follows: after the service is registered and published, the client retrieves information about it, downloads its WSDL, submits an XML request, and receives an XML response.

Because the service would be available to different consumers, security rules would be necessary. Responding to every request would not be sufficient: transmitted data would have to be protected so that only authorized parties received a response.

Encryption techniques address this problem. Routo Terada (2008) explains that cryptographic algorithms seek to protect confidential information from unauthorized access. A person without the required key cannot access the information.

Gomes further explains that digital certification relies on a distributed set of public-key servers. Each server is called a Certificate Authority (CA). A CA maintains a database that associates a public key with its owner's attributes. Each user receives a digital certificate containing the public key, the owner's details, and a cryptographic signature generated with the CA's private key.

## 3. Research method

### 3.1. Technologies used in software development

The proposed activities would not require field research. Research would be conducted in a laboratory through testing and supported by technology magazines, books, and online material. Because Java was selected as the implementation language, consulting its API documentation would also be essential.

### 3.2. Software development approach

Developing the system would require programming techniques and patterns that organized the project structure. One approach considered was *Domain-Driven Design* (DDD), introduced by Eric Evans. Although DDD was not yet widely adopted at the time, it brought together established software-development concepts and focused them on solving business-domain problems, which Evans regarded as the heart of software.

On Evans's contribution, Kelly Brown writes:

> What Eric has captured is part of the design process that experienced object designers have always used, but that we have simply not succeeded in communicating to the rest of the industry. We have shared pieces of this knowledge, but never organized and systematized the principles used to construct domain logic. This is an extremely important book. (BROWN, 2009, p. i, translated from the edition cited in the original paper)

In this approach, Evans emphasizes dividing code into layers: user interface, application, domain, and infrastructure. The domain layer contains the system's primary business rules. Layers should remain independent, and dependencies should respect their boundaries.

Encapsulating code in this way allows each part to be refactored separately. Changing the database, for example, would not require changing the domain layer. This would preserve the integrity of the system's central layer.

**Figure 1 - Architectural layers (Evans, 2009).** The original diagram arranges the system into four bands, from user interface to infrastructure. It shows components in the upper layers collaborating with the application and domain while technical details remain in the infrastructure layer.

## References

- RACHID, Jorge Antonio Deher. *Instrução Normativa SRF No. 580, December 12, 2005*. Brazilian Federal Revenue Service. Accessed November 30, 2010.
- ENCAT, National Meeting of Tax Coordinators and Administrators. *Electronic Invoice Project: Taxpayer Integration Manual. Technical Communication Standards*. Accessed November 30, 2010.
- TERADA, Routo. *Segurança de Dados: Criptografia em Redes de Computadores*. 2nd ed. São Paulo: Blucher, 2008, pp. 18, 177.
- GOMES, Daniel Adorno. *Web Services SOAP em Java: Guia Prático para o Desenvolvimento de Web Services em Java*. 1st ed. São Paulo: Novatec, 2010, pp. 13-17.
- EVANS, Eric. *Domain-Driven Design*. 1st ed. Rio de Janeiro: Alta Books, 2009, pp. 63-154.
- *Revista Java Magazine*. Grajaú, Rio de Janeiro, year VII, issue 72, September 2009, p. 70.
- *Revista Brasileira de Geografia*. Rio de Janeiro: IBGE, 1939-. Quarterly.
- DOMAIN-DRIVEN DESIGN COMMUNITY. *Navigation*. 2009. Available at <http://domaindrivendesign.org>. Accessed November 26, 2010.
