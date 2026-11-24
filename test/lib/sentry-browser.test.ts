import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserSentryOptions, startBrowserSentry } from '@/lib/sentry-browser';
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from '@/workers/observability/sentry-policy';

type Integration = { name: string };

const dsn = 'https://key@o1.ingest.us.sentry.io/2';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@/lib/sentry-browser');
  vi.resetModules();
});

describe('browser Sentry', () => {
  it('sends only errors from the site, with the shared data policy and no sessions', () => {
    const options = browserSentryOptions(dsn);
    expect(options).toMatchObject({
      dsn, environment: 'production', release: undefined, tracesSampleRate: 0, dataCollection: SENTRY_DATA_COLLECTION,
      beforeSend: scrubEvent, beforeBreadcrumb: scrubBreadcrumb, initialScope: { tags: { runtime: 'browser' } },
    });
    const [allowed] = options.allowUrls as RegExp[];
    expect(['https://fbrissi.dev/_next/a.js', 'https://www.fbrissi.dev/x', 'https://sandbox.fbrissi.dev/y'].every((url) => allowed.test(url))).toBe(true);
    expect(allowed.test('chrome-extension://abc/script.js')).toBe(false);
    expect(allowed.test('https://evil.example/fbrissi.dev/')).toBe(false);
    const integrations = options.integrations as (defaults: Integration[]) => Integration[];
    expect(integrations([{ name: 'BrowserSession' }, { name: 'GlobalHandlers' }]).map((item) => item.name)).toEqual(['GlobalHandlers']);
    expect(options.beforeSendLog!({ level: 'info', message: 'x' })).toBeNull();
    expect(options.beforeSendMetric!({ name: 'm', type: 'counter', value: 1 } as never)).toBeNull();
    expect(browserSentryOptions(dsn, 'sandbox', 'v0.4.3')).toMatchObject({ environment: 'sandbox', release: 'v0.4.3' });
  });

  it('loads and starts the SDK only when the build has a DSN', async () => {
    const init = vi.fn();
    const load = vi.fn(async () => ({ init }));
    expect(await startBrowserSentry('', load)).toBe(false);
    expect(load).not.toHaveBeenCalled();

    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENVIRONMENT', 'production');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_RELEASE', 'v0.4.3');
    expect(await startBrowserSentry(dsn, load)).toBe(true);
    expect(init).toHaveBeenCalledWith(expect.objectContaining({ dsn, environment: 'production', release: 'v0.4.3' }));

    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    expect(await startBrowserSentry()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', dsn);
    vi.stubEnv('NEXT_PUBLIC_SENTRY_RELEASE', '');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENVIRONMENT', '');
    expect(await startBrowserSentry(undefined, load)).toBe(true);
    expect(init).toHaveBeenLastCalledWith(expect.objectContaining({ environment: 'production', release: undefined }));
    // The real SDK, loaded on demand.
    expect(await startBrowserSentry()).toBe(true);
  });

  it('starts from the client instrumentation file and never breaks the page', async () => {
    const start = vi.fn().mockRejectedValue(new Error('blocked by an extension'));
    vi.doMock('@/lib/sentry-browser', () => ({ startBrowserSentry: start }));
    await import('@/instrumentation-client');
    expect(start).toHaveBeenCalledTimes(1);
  });
});
