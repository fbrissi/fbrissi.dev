---
title: Privacy Policy
description: How fbrissi.dev, its contact form and the English study groups program collect, use and protect personal data under the Brazilian General Data Protection Law (LGPD).
version: '2026-11-27'
---

This policy explains how `fbrissi.dev` handles personal data under the Brazilian General Data Protection Law (Law 13,709/2018, "LGPD"): the contact form (section 2) and the English study groups program at `fbrissi.dev/study-groups` (sections 3 to 5, 7 and 11); section 6 covers both, and the error monitoring of the whole site. Browsing the rest of the site doesn't require any personal data. Users in Brazil: the [Portuguese version](/pt-br/privacy) prevails.

## 1. Controller and contact

The controller is **Filipe Bojikian Rissi**, an individual based in Brazil. For any question, request or complaint about your data, use the [contact page](/contact) or write to contact@fbrissi.dev. For the English study groups program (program questions, abuse reports and requests about your study group data), write to **groups@fbrissi.dev**. As a small-scale processing agent, the controller is exempt from appointing a Data Protection Officer (CD/ANPD Resolution 2/2022), and this channel serves that purpose.

## 2. Contact form

- **Data:** the name, email address, subject and message you type in the form at [/contact](/contact), and the language of the page. If you email contact@fbrissi.dev or contato@fbrissi.dev directly instead, the same applies to your email address, the message, its attachments and the usual email headers. Cloudflare Turnstile checks that the form is sent by a person before the message is accepted; to do that, Turnstile processes signals from your browser and device, and the contact API sends your IP address to Cloudflare's Turnstile verification, and it also uses the IP address to rate-limit the form. The IP address is not part of the message and is not stored with it, but Cloudflare's operational logs of the Workers (Workers Logs) may keep request data, including the IP address, for up to 7 days.
- **Purpose:** to read and answer your message.
- **Legal basis:** legitimate interest in answering a message you chose to send (LGPD art. 7, IX), or the steps before a contract you asked for, such as a job or a project (art. 7, V). A request about your personal data is answered to comply with my legal obligation (art. 7, II).
- **Who handles it:** Cloudflare hosts the form, runs the contact API and its queue, sends the email, provides Turnstile and, through Cloudflare Email Routing, forwards emails sent directly to contact@fbrissi.dev and contato@fbrissi.dev. The mailbox that receives the message is a personal Gmail account; Google provides Gmail under its own terms and [privacy policy](https://policies.google.com/privacy). When I reply, the reply is sent from contact@fbrissi.dev through Amazon Simple Email Service (Amazon SES, by Amazon Web Services), which receives your email address and my reply, including any quoted text of your message. See section 6 for international transfer.
- **Retention:** the message, whether it came from the form or was emailed directly, is kept in my mailbox for up to 12 months and then deleted. The queue removes it once the email is delivered; a message that can't be delivered after the retries stays in a dead-letter queue for up to 24 hours (Cloudflare Queues' fixed retention on the Workers Free plan) and is then discarded.
- **Sharing:** your message is not shared with anyone else and is never used for marketing.

## 3. Study groups: data we collect

- **From Google, when you sign in:** your Google account identifier, email address, whether the email is verified, and your name. Google processes the sign-in under its own [privacy policy](https://policies.google.com/privacy). We don't store your profile picture.
- **Data you provide:** your display name; the groups you create (name, summary, rules, schedule, meeting link, access code and icon); join requests and their optional messages; memberships; suggestions with their notes and links; and votes.
- **Group icons:** the image an owner uploads (PNG, JPEG or WebP, up to 256 KB and 512 × 512 pixels), stored privately in Cloudflare R2. Before it is stored, its metadata (such as EXIF, which can include the place and time a photo was taken, and XMP, IPTC, comments and text chunks) is removed. We also count uploads per user and per group (user, group and date) to limit abuse.
- **Technical data:** a hash of your session token, timestamps, and records of your acceptance of the Terms and this policy (document, version and date).
- **Moderation:** when the platform admin deletes something, removes an icon, or bans an account, renews or lifts a ban, a log keeps a short label (such as a title, group name or display name), the reason and the date, never the full content.
- **Bans:** for a banned account, a ban record with the account, its Google account identifier, its email address, the reason, the admin who banned it, the date and the date it expires.
- **Service emails:** your email setting (on or off) and, for each service email, a record with its type, the group, its name and, for an admin deletion, the reason, plus its status and dates. The record never holds your email address, the requester's name or a join request message; the address is read from your account only when the email is sent.
- **IP address:** used only transiently by Cloudflare to apply rate limits against abuse. We don't store it in the database, but Cloudflare's operational logs of the Workers (Workers Logs) may keep request data, including the IP address, for up to 7 days.

## 4. Study groups: purposes and legal bases

| Purpose | Legal basis (LGPD art. 7) |
|---|---|
| Create and run your account, groups (including their icons), memberships, suggestions and votes | Performance of a contract: the Terms of Use (V) |
| Send service emails about the join requests to your groups, the decision on your own requests, the meetings of your groups, the deletion of your group or its icon by the platform admin, and a ban of your account or its lifting | Performance of a contract: the Terms of Use (V) |
| Security, rate limiting, abuse prevention, moderation, bans and the audit log | Legitimate interest (IX) |
| Find and fix errors in the site, the contact form and the program (error monitoring with Sentry, section 6) | Legitimate interest (IX) |
| Defending rights in legal, administrative or arbitration proceedings | Regular exercise of rights (VI) |

Consent is not the main legal basis. We record your acceptance of the Terms and this policy as evidence.

**Service emails:** we send only emails about your use of the program, never marketing: to a group owner, at most one email per group every 6 hours saying how many join requests are waiting (without the requesters' names or messages); to a requester, whether the request was approved or not; to an owner, when the platform admin deletes the group or removes its icon, with the reason; and to the owner and members of a group, a reminder of each meeting the day before (24 hours before) and on the day (2 hours before), with the time and the meeting link, unless the owner turned reminders off for the group. They are on by default. If your account is banned, you get one email saying so, with the reason and how to contest it, and when the ban is lifted, one short email saying your account was restored. Both are sent even if you turned service emails off, because a banned account can't sign in to see anything in the app. You can turn them off at any time on the account page or with the one-click unsubscribe link in every email; you will still see everything in the app. After a request is not approved, you can ask to join the same group again after 7 days.

**Legitimate interest balancing:** keeping the service safe for everyone requires limited, proportionate processing (rate limits, a moderation log with a short label and reason, and, for an account banned for breaking the content policy, a ban record that stops the same Google account or email from signing up again). This processing is expected by users, uses the minimum data, keeps no content body, and does not override your rights.

## 5. Study groups: who sees your data

- Members of your groups see your display name, your suggestions and your votes, and the group's icon. Anyone signed in who opens a group's join link sees its name, summary, icon, weekly meeting day and time, and whether it requires an access code.
- Group owners see the display name and the optional message in your join request. They are told by email that requests are waiting, without your name, message or email. **Your email is never shown** to members or owners.
- The public program page shows each listed group's name, summary, icon, weekly meeting day and time, and whether it requires an access code. Unlisted groups, and their icons, are never listed there. The meeting link is visible only to members. Icons are served through signed links that expire within 2 hours; until then, anyone who has the link can open the icon.
- While an account is banned, its suggestions, votes, memberships and join requests are hidden from other users.
- The platform admin can access any group to moderate it.
- We don't sell or share your data with third parties for marketing.

<span id="international-transfer"></span>

## 6. Service providers and international transfer

- **Cloudflare** hosts the site, the contact API and its queue, sends the contact form email, forwards emails sent to contact@fbrissi.dev, contato@fbrissi.dev and groups@fbrissi.dev (Email Routing), provides Turnstile, and for the study groups runs the API, stores the database (Cloudflare D1) and the group icons (Cloudflare R2), and applies rate limits.
- **Amazon Web Services (Amazon SES)** sends the study groups service emails, from notifications@fbrissi.dev with replies going to groups@fbrissi.dev, and my replies sent as contact@fbrissi.dev. It receives the recipient's email address, the subject and body of the email and sending metadata. If an email bounces or the recipient marks it as spam, Amazon SES may add the address to the account's suppression list, which stops further emails to it.
- **Sentry (Functional Software, Inc.)** receives error reports from the site, the contact form and the study groups API, so failures can be found and fixed (legitimate interest). A report holds the error message and where it happened in the code, the page or API path without its query string, the browser and operating system, the time and the site version. It never holds your name, email address, cookies, form fields, messages or request contents, and email addresses inside error messages are removed before sending. Sentry receives the IP address of the connection that sends the report, which we configure it not to store. Reports are kept for up to 90 days.
- **Google** provides the personal Gmail account that receives contact messages, under its own terms and [privacy policy](https://policies.google.com/privacy), and processes the study groups sign-in under its own privacy policy.

Some of these providers store or process data outside Brazil, including in the United States. In these cases, the data is transferred under the providers' contractual commitments to protect it and the safeguards allowed by LGPD art. 33. Each provider receives only the data it needs for its service. You can ask for more information about these transfers through the [contact page](/contact).

## 7. Study groups: retention

- Account data: until you delete your account.
- Sessions: 30 days after sign-in. The sign-in check cookie lasts 10 minutes.
- Deleting is permanent and immediate: a deleted suggestion, a removed icon or a deleted group (with its members' access, join requests, suggestions, votes, rounds and icon) is removed at once and can't be restored by you or by us. Deleted data can stay in the database's point-in-time recovery (Cloudflare D1 Time Travel) for up to 7 days before it is gone, and an icon that a browser already loaded may keep showing in that browser until its link expires (at most 2 hours).
- Group icons: until the owner replaces or removes the icon, the group is deleted, or the owner deletes the account. Icon upload counters: 1 day.
- Decided join requests: purged 30 days after the decision.
- Moderation log, including bans, renewals and unbans: 12 months.
- Ban records: while the ban lasts, for at most 2 years from the ban or its last renewal. Lifting the ban, or the end of those 2 years, deletes the record and the account can be used again. While an account is banned, its data is kept and hidden from other users.
- Email setting: until you delete your account.
- Service email records (the outbox and send log): 30 days after each email was created. The queue that hands an email to the sender holds only the record number; one that can't be sent after the retries stays in a dead-letter queue for up to 24 hours. Amazon SES keeps its own sending records under the AWS terms.
- Error reports in Sentry (whole site): up to 90 days.
- After you delete your account, your suggestions and votes in other groups stay anonymized as "Former member".

## 8. Your rights

Under LGPD art. 18 you can ask for: confirmation and access, correction, anonymization, blocking or deletion, portability, information about sharing, and review of how your data is used. In the app you can:

- **access and take your data** with "Download my data" on the account page, including the icons of the groups you own;
- **correct** your display name;
- **turn service emails off or on** on the account page, or turn them off with the unsubscribe link in any email;
- **delete** your account and its data.

If your account is banned, you can't sign in to use these tools: ask for a copy or the deletion of your data at groups@fbrissi.dev. For any other request about your study group data, write to groups@fbrissi.dev; for the contact form, use the [contact page](/contact). We answer within **15 days**. As a small-scale processing agent, I may use the extended deadlines of CD/ANPD Resolution 2/2022 (art. 14 and 15), but I aim to answer much sooner. You can also complain to the Brazilian Data Protection Authority (ANPD).

<span id="cookies"></span>

## 9. Cookies and local storage

We use only strictly necessary cookies and storage. There are no analytics or advertising cookies, so we show an informational notice instead of a consent request. If that ever changes, we will ask for your consent first. The error reporting (Sentry, section 6) sets no cookies and stores nothing in your browser.

| Name | Type | Purpose | Duration |
|---|---|---|---|
| `__Host-sg_session` | Strictly necessary, first-party, HttpOnly | Keeps you signed in | 30 days |
| `__Host-sg_oauth` | Strictly necessary, first-party, HttpOnly | Protects the Google sign-in (state, PKCE and nonce) | 10 minutes |
| `__Host-sg_signup` | Strictly necessary, first-party, HttpOnly | Holds your sign-in while you accept the Terms, before the account exists | 10 minutes |
| `fbrissi.dev:preferred-locale` (local storage) | Preference | Remembers your language | Until cleared |
| `study-groups:cookie-notice-dismissed` (local storage) | Preference | Remembers that you closed this notice | Until cleared |
| Cloudflare Turnstile (contact page only) | Security, set by Cloudflare | Bot protection | Per Cloudflare |

## 10. Security

Connections use HTTPS. Session cookies are HttpOnly, Secure and SameSite, and only a hash of the session token is stored. Every API call checks your permission, and abuse is rate limited. Group icons are kept in a private bucket and served only through signed links that expire within 2 hours. If a security incident may cause relevant risk or damage to you, we will notify the ANPD and the affected people, as required by CD/ANPD Resolution 15/2024.

## 11. Study groups: minors

The program is only for people aged 18 or older. If we learn that an account belongs to a minor, we delete it.

## 12. Changes to this policy

Each version of this policy has a date. When a version changes the policy materially (new processors, purposes, legal bases or transfers), study group members are asked to accept it at their next visit; until you do, you can keep reading but you can't make changes. Other changes, such as clarifications, take effect when published, with a new date.
