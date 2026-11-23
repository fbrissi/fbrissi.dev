import { STUDY_GROUPS_EMAIL } from './contract';
import { signRequest } from './sigv4';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

/** Sends one email and returns the provider's message ID. */
export type SendEmail = (email: OutgoingEmail) => Promise<{ messageId: string }>;

/** The provider refused this message for good (bad address, rejected content); retrying won't help. */
export class PermanentEmailError extends Error {}

export const NOTIFICATIONS_FROM_ADDRESS = 'notifications@fbrissi.dev';
export const NOTIFICATIONS_FROM = `English Study Groups <${NOTIFICATIONS_FROM_ADDRESS}>`;
export const NOTIFICATIONS_REPLY_TO = STUDY_GROUPS_EMAIL;

export interface SesConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  now?: () => Date;
}

// Errors about this message, not about the account, the quota or throttling.
const permanentErrors = new Set(['BadRequestException', 'MessageRejected', 'NotFoundException', 'MailFromDomainNotVerifiedException']);

async function errorType(response: Response): Promise<string> {
  const header = response.headers.get('x-amzn-ErrorType');
  if (header) return header.split(':')[0];
  const body = (await response.json().catch(() => null)) as { __type?: string } | null;
  return body?.__type?.split('#').pop() ?? 'Unknown';
}

/**
 * Amazon SES v2 SendEmail signed with SigV4, from notifications@fbrissi.dev with Reply-To groups@fbrissi.dev. Errors
 * carry only the status and the SES error type, never the recipient or the response body.
 */
export function createSesSender(config: SesConfig): SendEmail {
  const fetcher = config.fetch ?? ((input: string, init: RequestInit) => fetch(input, init));
  const url = `https://email.${config.region}.amazonaws.com/v2/email/outbound-emails`;

  return async (email) => {
    const body = JSON.stringify({
      FromEmailAddress: NOTIFICATIONS_FROM,
      Destination: { ToAddresses: [email.to] },
      ReplyToAddresses: [NOTIFICATIONS_REPLY_TO],
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: email.text, Charset: 'UTF-8' }, Html: { Data: email.html, Charset: 'UTF-8' } },
          Headers: Object.entries(email.headers).map(([Name, Value]) => ({ Name, Value })),
        },
      },
    });
    const headers = await signRequest(
      { method: 'POST', url, headers: { 'content-type': 'application/json' }, body },
      { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, region: config.region, service: 'ses' },
      config.now?.() ?? new Date()
    );

    const response = await fetcher(url, { method: 'POST', headers, body });
    if (response.ok) return { messageId: ((await response.json()) as { MessageId: string }).MessageId };

    const type = await errorType(response);
    const message = `SES SendEmail failed with ${response.status} ${type}`;
    if (response.status >= 400 && response.status < 500 && permanentErrors.has(type)) throw new PermanentEmailError(message);
    throw new Error(message);
  };
}
