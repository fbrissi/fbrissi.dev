import { captureException, type CloudflareOptions } from '@sentry/cloudflare';

import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from './sentry-policy';

/** Set by the Deploy workflow (`--var`); without a DSN (sandbox, local, tests) nothing is sent. */
export interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
}

export type SentryWorker = 'study-group-api' | 'study-group-mailer' | 'contact-api' | 'contact-email-consumer';

/** The `withSentry` options of a Worker: errors only (no traces, logs or metrics), tagged with the Worker. */
export function workerSentryOptions(worker: SentryWorker) {
  return (env: SentryEnv): CloudflareOptions | undefined => (env.SENTRY_DSN
    ? {
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT ?? 'production',
      release: env.SENTRY_RELEASE,
      tracesSampleRate: 0,
      dataCollection: SENTRY_DATA_COLLECTION,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
      beforeSendLog: () => null,
      beforeSendMetric: () => null,
      initialScope: { tags: { worker } },
    }
    : undefined);
}

/** Reports an error the code catches and handles (logged, retried or answered with 500); a no-op without a DSN. */
export function reportError(error: unknown): void {
  captureException(error);
}
