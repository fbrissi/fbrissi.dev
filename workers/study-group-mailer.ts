import { parseEmailAllowlist } from './study-group/authorization';
import { NOTIFICATION_LIMITS } from './study-group/contract';
import { PRODUCTION_ORIGIN, SANDBOX_ORIGIN } from './study-group/environment';
import { createNotificationSender } from './study-group/notification-sender';
import type { D1Like } from './study-group/repository';
import { createSesSender } from './study-group/ses';

export interface Env {
  /** The production or the sandbox database: each environment is its own Worker with its own binding. */
  STUDY_GROUP_DB: D1Like;
  STUDY_GROUP_ENVIRONMENT?: string;
  STUDY_GROUP_SES_REGION?: string;
  STUDY_GROUP_EMAIL_DAILY_CAP?: string;
  STUDY_GROUP_SES_ACCESS_KEY_ID?: string;
  STUDY_GROUP_SES_SECRET_ACCESS_KEY?: string;
  STUDY_GROUP_UNSUBSCRIBE_SECRET?: string;
  /** Sandbox only: comma-separated tester emails; nobody else gets email from the sandbox. */
  STUDY_GROUP_EMAIL_ALLOWLIST?: string;
}

export interface QueueMessage {
  body: unknown;
  attempts: number;
  ack: () => void;
  retry: (options?: { delaySeconds?: number }) => void;
}

export interface QueueBatch {
  messages: readonly QueueMessage[];
}

/** 30 s, 60 s, 120 s, … capped at 15 minutes. */
export function retryDelaySeconds(attempts: number): number {
  return Math.min(30 * 2 ** Math.max(attempts - 1, 0), 900);
}

function notificationId(body: unknown): number | null {
  const id = (body as { id?: unknown } | null)?.id;
  return Number.isSafeInteger(id) && (id as number) > 0 ? (id as number) : null;
}

/**
 * Consumer of the study group notifications queue (production or sandbox, from `[env.sandbox]`). Only this Worker holds
 * the SES credentials. Anything but `production` is treated as the sandbox: only allowlisted testers get email, and
 * subjects start with [SANDBOX].
 */
const studyGroupMailer = {
  async queue(batch: QueueBatch, env: Env): Promise<void> {
    const production = env.STUDY_GROUP_ENVIRONMENT === 'production';
    const deliver = createNotificationSender({
      db: env.STUDY_GROUP_DB,
      environment: production ? 'production' : 'sandbox',
      appOrigin: production ? PRODUCTION_ORIGIN : SANDBOX_ORIGIN,
      unsubscribeSecret: env.STUDY_GROUP_UNSUBSCRIBE_SECRET ?? '',
      allowlist: production ? null : parseEmailAllowlist(env.STUDY_GROUP_EMAIL_ALLOWLIST),
      dailyCap: Number(env.STUDY_GROUP_EMAIL_DAILY_CAP) || NOTIFICATION_LIMITS.defaultEmailsPerDay,
      send: createSesSender({
        accessKeyId: env.STUDY_GROUP_SES_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.STUDY_GROUP_SES_SECRET_ACCESS_KEY ?? '',
        region: env.STUDY_GROUP_SES_REGION ?? 'us-east-1',
      }),
    });

    for (const message of batch.messages) {
      const id = notificationId(message.body);
      if (id === null) {
        console.warn('Dropping a malformed study group notification message');
        message.ack();
        continue;
      }
      try {
        const outcome = await deliver(id);
        if (typeof outcome === 'object') message.retry({ delaySeconds: Math.min(outcome.deferSeconds, 86_400) });
        else message.ack();
      } catch (error) {
        // Only the row ID and the error: never the recipient.
        console.error('Unable to send study group notification', id, error instanceof Error ? error.message : error);
        message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
      }
    }
  },
};

export default studyGroupMailer;
