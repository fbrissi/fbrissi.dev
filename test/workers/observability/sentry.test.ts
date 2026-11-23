// @vitest-environment node
import type { Breadcrumb, ErrorEvent } from '@sentry/browser';
import { describe, expect, it, vi } from 'vitest';

import contactApi from '@/workers/contact-api';
import contactEmailConsumer from '@/workers/contact-email-consumer';
import { reportError, workerSentryOptions } from '@/workers/observability/sentry';
import { redact, scrubBreadcrumb, scrubEvent, SENTRY_DATA_COLLECTION, stripQuery } from '@/workers/observability/sentry-policy';
import studyGroupApi from '@/workers/study-group-api';
import studyGroupMailer from '@/workers/study-group-mailer';

describe('Sentry data policy', () => {
  it('removes email addresses and URL query strings from text', () => {
    expect(redact('SES rejected ana.maria+x@example.com.br, then Bob@Mail.Example.org')).toBe('SES rejected [email], then [email]');
    expect(redact('GET https://fbrissi.dev/study-groups/unsubscribe?t=secret#top failed')).toBe('GET https://fbrissi.dev/study-groups/unsubscribe failed');
    expect(redact('plain text without data')).toBe('plain text without data');
    expect(stripQuery('/api/study-group/auth/callback?code=abc&state=def')).toBe('/api/study-group/auth/callback');
  });

  it('keeps only URLs, method and status in breadcrumbs, and drops console and UI ones', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'owner@example.test' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'button' })).toBeNull();
    expect(scrubBreadcrumb({
      category: 'fetch',
      message: 'to x@example.test',
      data: { url: 'https://fbrissi.dev/api/study-group/unsubscribe?t=secret', method: 'POST', status_code: 500, body: 'x' },
    })).toEqual({ category: 'fetch', message: 'to [email]', data: { url: 'https://fbrissi.dev/api/study-group/unsubscribe', method: 'POST', status_code: 500 } });
    expect(scrubBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b#c', count: 2 } })).toEqual({ category: 'navigation', message: undefined, data: { from: '/a', to: '/b' } });
    expect(scrubBreadcrumb({ type: 'default' })).toEqual({ type: 'default', message: undefined, data: {} });
  });

  it('strips the user, extra data, request details, local variables and emails from events', () => {
    const event = {
      type: undefined,
      user: { id: 'u1', email: 'a@example.test', ip_address: '1.2.3.4' },
      extra: { body: 'secret' },
      request: { url: 'https://fbrissi.dev/study-groups/unsubscribe?t=secret', method: 'POST', headers: { cookie: 'x' }, data: 'body', query_string: 't=secret' },
      message: 'Failed for a@example.test',
      exception: { values: [{ type: 'Error', value: 'Address b@example.test rejected', stacktrace: { frames: [{ function: 'f', vars: { email: 'c@example.test' } }] } }, { type: 'Error' }] },
      breadcrumbs: [{ category: 'console', message: 'log' }, { category: 'http', data: { url: '/x?y=1' } }],
    } as unknown as ErrorEvent;
    expect(scrubEvent(event)).toEqual({
      type: undefined,
      request: { url: 'https://fbrissi.dev/study-groups/unsubscribe', method: 'POST' },
      message: 'Failed for [email]',
      exception: { values: [{ type: 'Error', value: 'Address [email] rejected', stacktrace: { frames: [{ function: 'f' }] } }, { type: 'Error' }] },
      breadcrumbs: [{ category: 'http', message: undefined, data: { url: '/x' } } satisfies Breadcrumb],
    });
    expect(scrubEvent({ type: undefined, request: {} } as ErrorEvent)).toEqual({ type: undefined, request: { url: undefined, method: undefined } });
    expect(scrubEvent({ type: undefined } as ErrorEvent)).toEqual({ type: undefined });
  });

  it('collects no user, cookies, headers, bodies or query strings', () => {
    expect(SENTRY_DATA_COLLECTION).toEqual({
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
      graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
    });
  });
});

describe('Worker Sentry options', () => {
  it('turns Sentry on only with a DSN, for errors only, tagged with the Worker', () => {
    expect(workerSentryOptions('contact-api')({})).toBeUndefined();
    const options = workerSentryOptions('study-group-api')({ SENTRY_DSN: 'https://key@o1.ingest.us.sentry.io/2', SENTRY_RELEASE: 'v0.4.3' })!;
    expect(options).toMatchObject({
      dsn: 'https://key@o1.ingest.us.sentry.io/2', environment: 'production', release: 'v0.4.3', tracesSampleRate: 0,
      dataCollection: SENTRY_DATA_COLLECTION, beforeSend: scrubEvent, beforeBreadcrumb: scrubBreadcrumb, initialScope: { tags: { worker: 'study-group-api' } },
    });
    expect(options.beforeSendLog!({ level: 'info', message: 'x' })).toBeNull();
    expect(options.beforeSendMetric!({ name: 'm', type: 'counter', value: 1 } as never)).toBeNull();
    expect(workerSentryOptions('study-group-mailer')({ SENTRY_DSN: 'd', SENTRY_ENVIRONMENT: 'sandbox' })).toMatchObject({ environment: 'sandbox' });
  });

  it('reports handled errors without a client as a no-op', () => {
    expect(() => reportError(new Error('boom'))).not.toThrow();
  });

  it('deploys every Worker instrumented, still answering without a DSN', async () => {
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} };
    for (const worker of [contactApi, contactEmailConsumer, studyGroupApi, studyGroupMailer]) {
      expect(Object.keys(worker).length).toBeGreaterThan(0);
    }
    const response = await (contactApi.fetch as (request: Request, env: object, context: typeof ctx) => Promise<Response>)(
      new Request('https://fbrissi.dev/api/contact', { method: 'OPTIONS', headers: { Origin: 'https://fbrissi.dev' } }), {}, ctx,
    );
    expect(response.status).toBeLessThan(500);
  });
});
