import type { ContactMessage } from './contact-message';
import { contactEmailHtml, contactEmailSubject, contactEmailText } from './templates/contact-email';

export interface Env {
  CONTACT_EMAIL_TO: string;
  CONTACT_EMAIL_FROM: string;
  SEND_EMAIL: { send: (message: EmailMessage) => Promise<void> };
}

declare class EmailMessage {
  constructor(from: string, to: string, raw: string);
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
        await sendEmail(env, message.body);
      } catch (error) {
        console.error('Unable to deliver contact form email:', error);
        message.retry();
      }
    }
  },
};

export default contactEmailConsumer;

async function sendEmail(env: Env, message: ContactMessage): Promise<void> {
  await env.SEND_EMAIL.send(new EmailMessage(
    env.CONTACT_EMAIL_FROM,
    env.CONTACT_EMAIL_TO,
    buildRawEmail(env, message)
  ));
}

function buildRawEmail(env: Env, message: ContactMessage): string {
  const boundary = `contact-form-${crypto.randomUUID()}`;
  const replyToName = message.name.replace(/[\r\n]/g, ' ').replace(/([\\"])/g, '\\$1');
  const replyToEmail = message.email.replace(/[\r\n]/g, '');
  const subject = contactEmailSubject(message, { isLocal: false }).replace(/[\r\n]/g, ' ');

  return [
    `From: Contact Form <${env.CONTACT_EMAIL_FROM}>`,
    `To: ${env.CONTACT_EMAIL_TO}`,
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
