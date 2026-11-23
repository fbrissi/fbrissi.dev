import type { z } from 'zod';
import type { Role } from './authorization';
import { REASON_REQUIRED_MESSAGE, type ErrorResponse } from './contract';
import type { CacheLike, JwksProvider, OidcClient } from './oidc';
import type { BucketLike } from './icons';
import { deleteIconObjects, signIconUrl, validIconUrls } from './icons';
import type { GroupRecord, QueuedNotification, SessionUser, StoredIcon, StudyGroupRepository } from './repository';

export type RateLimitKind = 'read' | 'write' | 'auth' | 'join' | 'icon';
export type FetchLike = (input: Request | string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly issues?: unknown[]) {
    super(message);
  }
}

export const SESSION_COOKIE = '__Host-sg_session';
export const OAUTH_COOKIE = '__Host-sg_oauth';
export const SIGNUP_COOKIE = '__Host-sg_signup';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const FLOW_TTL_MS = 10 * 60 * 1000;
export const NOTICE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface AppConfig {
  repository: StudyGroupRepository;
  appOrigin: string;
  oidc: OidcClient;
  sessionSecret: string;
  platformAdminEmails: readonly string[];
  fetch: FetchLike;
  getKey: JwksProvider;
  cache?: CacheLike;
  clock: () => Date;
  pick: <T>(items: T[]) => T;
  /** Environment name signed into unsubscribe links, so a link only works where it was sent from. */
  environment: string;
  /** Verifies one-click unsubscribe links; they are rejected while it is empty. */
  unsubscribeSecret: string;
  /** Hands new outbox rows to the mailer (the notifications queue, or an in-process sender locally). */
  notify?: (notifications: QueuedNotification[]) => Promise<void>;
  /** The private group icon bucket (R2, or a local folder). Icons are off without it or without the session secret. */
  icons?: BucketLike;
}

export interface RequestContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
  user: SessionUser | null;
  isPlatformAdmin: boolean;
  sessionHash: string | null;
  role: Role;
  /** Set on routes under /groups/:groupId. */
  group: GroupRecord | null;
  isMember: boolean;
  app: AppConfig;
}

/** A context whose route requires a signed-in user. */
export type UserContext = RequestContext & { user: SessionUser };
/** A context whose route is scoped to a group and requires a signed-in user. */
export type GroupContext = UserContext & { group: GroupRecord };

export type RouteResult = Response | { status: number; body: object } | null;

export function now(context: RequestContext): string {
  return context.app.clock().toISOString();
}

/**
 * Queues the outbox rows a write created. The state change is already committed, so a queue failure is only logged
 * (with the row IDs, never an address); the daily cron queues rows that were never picked up.
 */
export async function enqueueNotifications(context: RequestContext, notifications: QueuedNotification[]): Promise<void> {
  if (!notifications.length || !context.app.notify) return;
  try {
    await context.app.notify(notifications);
  } catch (error) {
    console.error('Unable to queue study group notifications:', notifications.map((item) => item.id), error instanceof Error ? error.message : error);
  }
}

/** The signed URL of a stored icon, or null when there is none or icons are off. */
export async function iconUrl(context: RequestContext, icon: StoredIcon | null): Promise<string | null> {
  const { app } = context;
  return icon && app.icons && app.sessionSecret ? signIconUrl(app.sessionSecret, icon.key, app.clock()) : null;
}

/**
 * Deletes icon objects after their rows are gone and purges every still-valid signed URL of them from the edge cache.
 * The Cache API is per data center, so the purge only reaches the data center that handles this request; a copy cached
 * elsewhere (and in browsers) can be served until its link expires, at most 2 hours.
 */
export async function removeIcons(context: RequestContext, keys: string[]): Promise<void> {
  const { app } = context;
  await deleteIconObjects(app.icons, keys);
  if (!app.cache || !app.sessionSecret) return;
  for (const key of keys) {
    for (const path of await validIconUrls(app.sessionSecret, key, app.clock())) await app.cache.delete(new Request(`${context.url.origin}${path}`));
  }
}

/** Reads a raw body up to `limit` bytes; a larger body is refused before it is read in full (413). */
export async function readLimitedBody(request: Request, limit: number, message: string): Promise<Uint8Array> {
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, message);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const chunk = reader ? await reader.read() : { done: true as const, value: undefined };
    if (chunk.done) break;
    total += chunk.value.length;
    if (total > limit) {
      await reader!.cancel();
      throw new HttpError(413, message);
    }
    chunks.push(chunk.value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}

export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    // A bad moderation reason gets the same plain message on every admin route.
    const reasonIssue = result.error.issues.some((issue) => issue.path[0] === 'reason');
    throw new HttpError(400, reasonIssue ? REASON_REQUIRED_MESSAGE : 'Invalid request', result.error.issues);
  }
  return result.data;
}

export function parseCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) cookies.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  return cookies;
}

/** First-party, host-only cookie that JavaScript never reads. */
export function setCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(name: string): string {
  return setCookie(name, '', 0);
}

export function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

export function errorBody(error: HttpError): ErrorResponse {
  const body: ErrorResponse = { error: error.message };
  if (error.issues) body.issues = error.issues;
  return body;
}
