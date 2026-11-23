import type { Breadcrumb, BrowserOptions, ErrorEvent } from '@sentry/browser';

type DataCollection = NonNullable<BrowserOptions['dataCollection']>;

/**
 * What the Workers and the browser send to Sentry: errors only, with no user, cookies, headers, request or response
 * bodies, or URL query strings (they carry unsubscribe tokens and OAuth codes). Email addresses in messages are
 * replaced, so an address in a provider error never leaves the app. See the Privacy Policy (Sentry, section 6).
 */
export const SENTRY_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
};

const EMAIL = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/gi;
const URL_WITH_QUERY = /(https?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi;
/** Breadcrumb data kept, with URLs stripped to origin and path; everything else is dropped. */
const URL_KEYS = ['url', 'from', 'to'] as const;
const KEPT_KEYS = ['method', 'status_code'] as const;

/** The URL without its query string and fragment. */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '');
}

/** Email addresses and URL query strings removed from free text. */
export function redact(text: string): string {
  return text.replace(EMAIL, '[email]').replace(URL_WITH_QUERY, '$1');
}

/** Console and UI breadcrumbs are dropped (they can hold typed text or names); others keep only URLs, method and status. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console' || breadcrumb.category?.startsWith('ui.')) return null;
  const data: Record<string, unknown> = {};
  for (const key of URL_KEYS) if (typeof breadcrumb.data?.[key] === 'string') data[key] = stripQuery(breadcrumb.data[key]);
  for (const key of KEPT_KEYS) if (breadcrumb.data?.[key] !== undefined) data[key] = breadcrumb.data[key];
  return { ...breadcrumb, message: breadcrumb.message && redact(breadcrumb.message), data };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.extra;
  if (event.request) event.request = { url: event.request.url && stripQuery(event.request.url), method: event.request.method };
  if (event.message) event.message = redact(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redact(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((item): item is Breadcrumb => item !== null);
  return event;
}
