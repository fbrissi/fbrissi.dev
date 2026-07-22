import { EmailMessage } from 'cloudflare:email';
import type { ContactMessage } from './contact-message';
import { resolveContactLocale } from './contact-message';
import {
  contactConfirmationEmailHtml,
  contactConfirmationEmailSubject,
  contactConfirmationEmailText,
} from './templates/contact-confirmation-email';
import { contactEmailHtml, contactEmailSubject, contactEmailText } from './templates/contact-email';

export interface Env {
  CONTACT_EMAIL_TO: string;
  CONTACT_EMAIL_DISPLAY_TO: string;
  CONTACT_EMAIL_FROM: string;
  SEND_EMAIL: { send: (message: EmailMessage) => Promise<void> };
}

interface QueueMessage {
  body: ContactMessage;
  retry: () => void;
}

interface QueueBatch {
  messages: QueueMessage[];
}

const contactEmailConsumer = {
  async queue(batch: QueueBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await sendEmails(env, message.body);
      } catch (error) {
        console.error('Unable to deliver contact form email:', error);
        message.retry();
      }
    }
  },
};

export default contactEmailConsumer;

async function sendEmails(env: Env, rawMessage: ContactMessage): Promise<void> {
  const message: ContactMessage = { ...rawMessage, locale: resolveContactLocale(rawMessage.locale) };
  await env.SEND_EMAIL.send(new EmailMessage(
    env.CONTACT_EMAIL_FROM,
    env.CONTACT_EMAIL_TO,
    buildOwnerRawEmail(env, message)
  ));
}

export async function sendConfirmationEmail(env: Env, message: ContactMessage): Promise<void> {
  try {
    const confirmationTo = sanitizeHeaderValue(message.email);
    await env.SEND_EMAIL.send(new EmailMessage(
      env.CONTACT_EMAIL_FROM,
      confirmationTo,
      buildConfirmationRawEmail(env, message, confirmationTo)
    ));
  } catch (error) {
    console.error('Unable to deliver contact form confirmation email:', error);
  }
}

function buildOwnerRawEmail(env: Env, message: ContactMessage): string {
  const boundary = `contact-form-${crypto.randomUUID()}`;
  const replyToName = message.name.replace(/[\r\n]/g, ' ').replace(/([\\"])/g, '\\$1');
  const replyToEmail = sanitizeHeaderValue(message.email);
  const subject = contactEmailSubject(message, { isLocal: false }).replace(/[\r\n]/g, ' ');

  return [
    `From: Contact Form <${env.CONTACT_EMAIL_FROM}>`,
    `To: ${env.CONTACT_EMAIL_DISPLAY_TO}`,
    `Reply-To: "${replyToName}" <${replyToEmail}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    contactEmailText(message, { isLocal: false }),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    contactEmailHtml(message, { isLocal: false }),
    '',
    `--${boundary}--`,
  ].join('\r\n');
}

function buildConfirmationRawEmail(env: Env, message: ContactMessage, to: string): string {
  const boundary = `contact-confirmation-${crypto.randomUUID()}`;
  const subject = contactConfirmationEmailSubject(message, { isLocal: false }).replace(/[\r\n]/g, ' ');

  return [
    `From: Filipe <${env.CONTACT_EMAIL_FROM}>`,
    `To: ${to}`,
    `Reply-To: ${env.CONTACT_EMAIL_FROM}`,
    `Subject: ${subject}`,
    'Auto-Submitted: auto-replied',
    'X-Auto-Response-Suppress: All',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    contactConfirmationEmailText(message, { isLocal: false }),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    contactConfirmationEmailHtml(message, { isLocal: false }),
    '',
    `--${boundary}--`,
  ].join('\r\n');
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]/g, '');
}
