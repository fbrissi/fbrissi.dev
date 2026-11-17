import type { z } from 'zod';
import type { Role } from './authorization';
import type { ErrorResponse } from './contract';
import type { CacheLike, JwksProvider, OidcClient } from './oidc';
import type { GroupRecord, SessionUser, StudyGroupRepository } from './repository';

export type RateLimitKind = 'read' | 'write' | 'auth' | 'join';
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

export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, 'Invalid request', result.error.issues);
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
