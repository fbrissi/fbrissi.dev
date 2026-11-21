---
title: Privacy Policy
description: How fbrissi.dev, its contact form and the English study groups program collect, use and protect personal data under the Brazilian General Data Protection Law (LGPD).
version: '2026-11-21'
---

This policy explains how `fbrissi.dev` handles personal data under the Brazilian General Data Protection Law (Law 13,709/2018, "LGPD"): the contact form (section 2) and the English study groups program at `fbrissi.dev/study-groups` (sections 3 to 5, 7 and 11); section 6 covers both. Browsing the rest of the site doesn't require any personal data. Users in Brazil: the [Portuguese version](/pt-br/privacy) prevails.

## 1. Controller and contact

The controller is **Filipe Bojikian Rissi**, an individual based in Brazil. For any question, request or complaint about your data, use the [contact page](/contact) or write to contact@fbrissi.dev. As a small-scale processing agent, the controller is exempt from appointing a Data Protection Officer (CD/ANPD Resolution 2/2022), and this channel serves that purpose.

## 2. Contact form

- **Data:** the name, email address, subject and message you type in the form at [/contact](/contact), and the language of the page. Cloudflare Turnstile checks that the form is sent by a person before the message is accepted; to do that, the contact API sends your IP address to Cloudflare's Turnstile verification, and it also uses the IP address to rate-limit the form. The IP address is not part of the message and is not stored with it, but Cloudflare's operational logs of the Workers (Workers Logs) may keep request data, including the IP address, for up to 7 days.
- **Purpose:** to read and answer your message.
- **Legal basis:** legitimate interest in answering a message you chose to send (LGPD art. 7, IX), or the steps before a contract you asked for, such as a job or a project (art. 7, V).
- **Processors:** Cloudflare hosts the form, runs the contact API and its queue, sends the email and provides Turnstile. Google (Gmail) hosts the mailbox that receives the message. See section 6 for international transfers.
- **Retention:** the message is kept in my mailbox for up to 12 months and then deleted. The queue removes it once the email is delivered; a message that can't be delivered after the retries stays in a dead-letter queue for up to 4 days (Cloudflare Queues' default retention) and is then discarded.
- **Sharing:** your message is not shared with anyone else and is never used for marketing.

## 3. Study groups: data we collect

- **From Google, when you sign in:** your Google account identifier, email address, whether the email is verified, and your name. We don't store your profile picture.
- **Data you provide:** your display name; the groups you create (name, summary, rules, schedule, meeting link, access code); join requests and their optional messages; memberships; suggestions with their notes and links; and votes.
- **Technical data:** a hash of your session token, timestamps, and records of your acceptance of the Terms and this policy (document, version and date).
- **Moderation:** when the platform admin deletes something, a log keeps a short label (such as a title or group name), the reason and the date, never the full content.
- **IP address:** used only transiently by Cloudflare to apply rate limits against abuse. We don't store it in the database, but Cloudflare's operational logs of the Workers (Workers Logs) may keep request data, including the IP address, for up to 7 days.

## 4. Study groups: purposes and legal bases

| Purpose | Legal basis (LGPD art. 7) |
|---|---|
| Create and run your account, groups, memberships, suggestions and votes | Performance of a contract: the Terms of Use (V) |
| Security, rate limiting, abuse prevention, moderation and the audit log | Legitimate interest (IX) |
| Defending rights in legal, administrative or arbitration proceedings | Regular exercise of rights (VI) |

Consent is not the main legal basis. We record your acceptance of the Terms and this policy as evidence.

**Legitimate interest balancing:** keeping the service safe for everyone requires limited, proportionate processing (rate limits, a deletion log with a short label and reason). This processing is expected by users, uses the minimum data, keeps no content body, and does not override your rights.

## 5. Study groups: who sees your data

- Members of your groups see your display name, your suggestions and your votes.
- Group owners see the display name and the optional message in your join request. **Your email is never shown** to members or owners.
- The public page shows only each listed group's name and summary. The meeting link is visible only to members.
- The platform admin can access any group to moderate it.
- We don't sell or share your data with third parties for marketing.

## 6. Processors and international transfer

- **Cloudflare** hosts the site, the contact API and its queue, sends the contact form email, provides Turnstile, and for the study groups runs the API, stores the database (Cloudflare D1) and applies rate limits.
- **Google** provides the study groups sign-in, and hosts the mailbox (Gmail) that receives contact form messages.

Both may process data outside Brazil, including in the United States. These transfers rely on the processors' contractual commitments and data protection terms (LGPD art. 33).

## 7. Study groups: retention

- Account data: until you delete your account.
- Sessions: 30 days after sign-in. The sign-in check cookie lasts 10 minutes.
- Deleted content and deleted groups: purged 30 days after deletion.
- Decided join requests: purged 30 days after the decision.
- Moderation log: 12 months.
- After you delete your account, your suggestions and votes in other groups stay anonymized as "Former member".

## 8. Your rights

Under LGPD art. 18 you can ask for: confirmation and access, correction, anonymization, blocking or deletion, portability, information about sharing, and review of how your data is used. In the app you can:

- **access and take your data** with "Download my data" on the account page;
- **correct** your display name;
- **delete** your account and its data.

For any other request, use the [contact page](/contact). We answer within **15 days**. You can also complain to the Brazilian Data Protection Authority (ANPD).

<span id="cookies"></span>

## 9. Cookies and local storage

We use only strictly necessary cookies and storage. There are no analytics or advertising cookies, so we show an informational notice instead of a consent request. If that ever changes, we will ask for your consent first.

| Name | Type | Purpose | Duration |
|---|---|---|---|
| `__Host-sg_session` | Strictly necessary, first-party, HttpOnly | Keeps you signed in | 30 days |
| `__Host-sg_oauth` | Strictly necessary, first-party, HttpOnly | Protects the Google sign-in (state, PKCE and nonce) | 10 minutes |
| `__Host-sg_signup` | Strictly necessary, first-party, HttpOnly | Holds your sign-in while you accept the Terms, before the account exists | 10 minutes |
| `fbrissi.dev:preferred-locale` (local storage) | Preference | Remembers your language | Until cleared |
| `study-groups:cookie-notice-dismissed` (local storage) | Preference | Remembers that you closed this notice | Until cleared |
| Cloudflare Turnstile (contact page only) | Security, set by Cloudflare | Bot protection | Per Cloudflare |

## 10. Security

Connections use HTTPS. Session cookies are HttpOnly, Secure and SameSite, and only a hash of the session token is stored. Every API call checks your permission, and abuse is rate limited. If a security incident may cause relevant risk or damage to you, we will notify the ANPD and the affected people, as required by CD/ANPD Resolution 15/2024.

## 11. Study groups: minors

The program is only for people aged 18 or older. If we learn that an account belongs to a minor, we delete it.

## 12. Changes to this policy

Each version of this policy has a date. When a new version is published, study group members are asked to accept it at their next visit; until you do, you can keep reading but you can't make changes.
