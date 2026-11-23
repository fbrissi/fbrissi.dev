import type { BrowserOptions } from '@sentry/browser';

import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from '@/workers/observability/sentry-policy';

type SentryBrowser = Pick<typeof import('@sentry/browser'), 'init'>;

/**
 * Errors only from the site's own scripts (not extensions or other origins), with no sessions, traces, replays, logs
 * or metrics, and the same data policy as the Workers.
 */
export function browserSentryOptions(dsn: string, environment = 'production', release?: string): BrowserOptions {
  return {
    dsn,
    environment,
    release,
    allowUrls: [/^https:\/\/(www\.|sandbox\.)?fbrissi\.dev\//],
    integrations: (defaults) => defaults.filter((integration) => integration.name !== 'BrowserSession'),
    tracesSampleRate: 0,
    dataCollection: SENTRY_DATA_COLLECTION,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    initialScope: { tags: { runtime: 'browser' } },
  };
}

/** Loads the SDK only when the build has a DSN (production), so local and preview builds never download it. */
export async function startBrowserSentry(
  dsn = process.env.NEXT_PUBLIC_SENTRY_DSN,
  load: () => Promise<SentryBrowser> = () => import('./sentry-browser-sdk'),
): Promise<boolean> {
  if (!dsn) return false;
  const sentry = await load();
  sentry.init(browserSentryOptions(dsn, process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || undefined, process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined));
  return true;
}
