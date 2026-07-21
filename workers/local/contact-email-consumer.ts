import { DeleteMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import nodemailer from 'nodemailer';
import { resolveContactLocale, type ContactMessage } from '../contact-message';
import {
  contactConfirmationEmailHtml,
  contactConfirmationEmailSubject,
  contactConfirmationEmailText,
} from '../templates/contact-confirmation-email';
import { contactEmailHtml, contactEmailSubject, contactEmailText } from '../templates/contact-email';
import { getContactQueueUrl, sqs } from './queue';

const pollWaitSeconds = 10;
const transporter = nodemailer.createTransport({
  host: process.env.MAILPIT_SMTP_HOST ?? 'mailpit',
  port: Number(process.env.MAILPIT_SMTP_PORT ?? 1025),
  secure: false,
});

async function consume(): Promise<void> {
  const queueUrl = await getContactQueueUrl();
  console.log(`Consuming contact emails from ${queueUrl}`);

  while (true) {
    const result = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: pollWaitSeconds,
      VisibilityTimeout: 30,
    }));

    for (const message of result.Messages ?? []) {
      if (!message.Body || !message.ReceiptHandle) continue;

      try {
        const rawMessage = JSON.parse(message.Body) as ContactMessage;
        const normalizedMessage: ContactMessage = { ...rawMessage, locale: resolveContactLocale(rawMessage.locale) };
        await deliver(normalizedMessage);
        await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }));
      } catch (error) {
        console.error('Unable to deliver queued contact form email:', error);
      }
    }
  }
}

async function deliver(message: ContactMessage): Promise<void> {
  const from = process.env.CONTACT_EMAIL_FROM ?? 'noreply@fbrissi.dev';

  await transporter.sendMail({
    from,
    to: process.env.CONTACT_EMAIL_TO ?? 'hello@fbrissi.dev',
    replyTo: { address: message.email, name: message.name },
    subject: contactEmailSubject(message, { isLocal: true }),
    text: contactEmailText(message, { isLocal: true }),
    html: contactEmailHtml(message, { isLocal: true }),
  });

  try {
    await transporter.sendMail({
      from: { address: from, name: 'Filipe' },
      to: message.email,
      replyTo: from,
      subject: contactConfirmationEmailSubject(message, { isLocal: true }),
      text: contactConfirmationEmailText(message, { isLocal: true }),
      html: contactConfirmationEmailHtml(message, { isLocal: true }),
      headers: {
        'Auto-Submitted': 'auto-replied',
        'X-Auto-Response-Suppress': 'All',
      },
    });
  } catch (error) {
    console.error('Unable to deliver contact form confirmation email:', error);
  }
}

consume().catch((error) => {
  console.error('Contact email consumer stopped:', error);
  process.exit(1);
});
