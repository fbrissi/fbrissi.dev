import { parseEmailAllowlist } from './study-group/authorization';
import { environmentOrigins, PRODUCTION_ORIGIN } from './study-group/environment';
import { createHandler, type RateLimitKind } from './study-group/handler';
import { deleteOrphanIcons, type BucketLike } from './study-group/icons';
import { GOOGLE_OIDC, type CacheLike } from './study-group/oidc';
import { createRepository, type D1Like, type QueuedNotification } from './study-group/repository';

export interface Env {
  /** The production or the sandbox database: each environment is its own Worker with its own binding. */
  STUDY_GROUP_DB: D1Like;
  STUDY_GROUP_ENVIRONMENT?: string;
  STUDY_GROUP_READ_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_WRITE_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_LOGIN_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_JOIN_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_ICON_RATE_LIMITER: RateLimiter;
  /** The private R2 bucket of group icons; only this Worker reads it, through signed URLs. */
  STUDY_GROUP_ICONS: BucketLike;
  STUDY_GROUP_SESSION_SECRET?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  STUDY_GROUP_PLATFORM_ADMIN_EMAILS?: string;
  STUDY_GROUP_UNSUBSCRIBE_SECRET?: string;
  /** Producer of this environment's notifications queue, consumed by the mailer Worker. Messages carry only the row ID. */
  STUDY_GROUP_NOTIFY_QUEUE: NotifyQueue;
}

export interface NotifyQueue {
  sendBatch: (messages: { body: { id: number }; delaySeconds: number }[]) => Promise<unknown>;
}

interface RateLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

export { environmentOrigins };

/** Outbox rows idle for longer than this (beyond the longest retry delay) are queued again by the daily cron. */
const REQUEUE_AFTER_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Seconds until `sendAfter`, within the queue's 0 to 24-hour delay range. */
export function delaySeconds(sendAfter: string, now: number): number {
  return Math.min(Math.max(Math.ceil((Date.parse(sendAfter) - now) / 1000), 0), DAY_MS / 1000);
}

function notifier(env: Env): (notifications: QueuedNotification[]) => Promise<void> {
  return async (notifications) => {
    const now = Date.now();
    await env.STUDY_GROUP_NOTIFY_QUEUE.sendBatch(notifications.map(({ id, sendAfter }) => ({ body: { id }, delaySeconds: delaySeconds(sendAfter, now) })));
  };
}

function environmentName(env: Env): string {
  return env.STUDY_GROUP_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production';
}

function defaultCache(): CacheLike | undefined {
  return (globalThis.caches as unknown as { default?: CacheLike } | undefined)?.default;
}

/**
 * Entry point of the production and sandbox Workers. It always signs in with Google's fixed endpoints (GOOGLE_OIDC);
 * no binding or variable can point it at another identity provider. The fake IdP exists only in the local Docker
 * stack (workers/local).
 */
const studyGroupApi = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Session cookies are host-only, so sign-in always runs on the canonical host.
    if (url.hostname === 'www.fbrissi.dev' && url.pathname === '/api/study-group/auth/login') {
      return Response.redirect(`${PRODUCTION_ORIGIN}${url.pathname}${url.search}`, 302);
    }
    const limiters: Record<RateLimitKind, RateLimiter> = {
      read: env.STUDY_GROUP_READ_RATE_LIMITER,
      write: env.STUDY_GROUP_WRITE_RATE_LIMITER,
      auth: env.STUDY_GROUP_LOGIN_RATE_LIMITER,
      join: env.STUDY_GROUP_JOIN_RATE_LIMITER,
      icon: env.STUDY_GROUP_ICON_RATE_LIMITER,
    };

    return createHandler({
      db: env.STUDY_GROUP_DB,
      ...environmentOrigins(env),
      oidc: {
        provider: GOOGLE_OIDC,
        clientId: env.GOOGLE_OAUTH_CLIENT_ID ?? '',
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      },
      sessionSecret: env.STUDY_GROUP_SESSION_SECRET ?? '',
      platformAdminEmails: parseEmailAllowlist(env.STUDY_GROUP_PLATFORM_ADMIN_EMAILS),
      environment: environmentName(env),
      unsubscribeSecret: env.STUDY_GROUP_UNSUBSCRIBE_SECRET ?? '',
      notify: notifier(env),
      icons: env.STUDY_GROUP_ICONS,
      cache: defaultCache(),
      async rateLimit(kind, key) {
        const { success } = await limiters[kind].limit({ key });
        return success;
      },
    })(request);
  },

  /**
   * Daily retention purge (Q6) of this environment's database, then the email re-drive: idle outbox rows are queued
   * again, exhausted ones are marked failed, and failures are logged as counts (never addresses).
   */
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    const repository = createRepository(env.STUDY_GROUP_DB);
    const now = new Date();
    await repository.purgeExpired(now);
    const { requeue, failedLastDay } = await repository.recoverNotifications(
      new Date(now.getTime() - REQUEUE_AFTER_MS).toISOString(), new Date(now.getTime() - DAY_MS).toISOString(), 100
    );
    if (requeue.length || failedLastDay) console.warn('Study group notifications needing attention:', { requeued: requeue.length, failedLastDay });
    if (requeue.length) await notifier(env)(requeue);
    // Objects no group points at (a failed delete, or an upload whose row was never written), after an hour.
    const orphans = await deleteOrphanIcons(env.STUDY_GROUP_ICONS, await repository.listIconKeys(), new Date(now.getTime() - 60 * 60 * 1000));
    if (orphans) console.warn('Deleted orphaned study group icons:', orphans);
  },
};

export default studyGroupApi;
