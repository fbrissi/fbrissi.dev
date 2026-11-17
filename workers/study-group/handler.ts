import * as auth from './auth-routes';
import { authorize, isPlatformAdminEmail, resolveGroupRole, resolveRole, type Role } from './authorization';
import * as board from './board-routes';
import { STUDY_GROUP_API_PREFIX } from './contract';
import { cryptoRandomInt, sha256Hex } from './crypto';
import * as groups from './group-routes';
import { canParticipate } from './group-routes';
import {
  errorBody,
  HttpError,
  parseCookies,
  SESSION_COOKIE,
  type AppConfig,
  type FetchLike,
  type RateLimitKind,
  type RequestContext,
  type RouteResult,
} from './http';
import { createJwksProvider, type CacheLike, type OidcClient } from './oidc';
import { createRepository, type D1Like } from './repository';

export type { RateLimitKind } from './http';

export interface StudyGroupHandlerDeps {
  db: D1Like;
  /** Origins allowed to send state-changing requests (CSRF check). */
  allowedOrigins: readonly string[];
  /** Origin of the site pages; the OAuth redirect URI and post-sign-in redirects use it. */
  appOrigin: string;
  oidc: OidcClient;
  /** Signs the short-lived OAuth and sign-up cookies. Sign-in is disabled while it is empty. */
  sessionSecret: string;
  platformAdminEmails: readonly string[];
  /** Returns false when the request exceeds its rate limit; the key is the user ID when signed in, else the IP. */
  rateLimit?: (kind: RateLimitKind, key: string) => Promise<boolean>;
  fetch?: FetchLike;
  cache?: CacheLike;
  now?: () => Date;
  /** Returns an integer in [0, max). */
  randomInt?: (max: number) => number;
}

type Handler = (context: never) => Promise<RouteResult>;

interface Route {
  method: string;
  path: string;
  /** Minimum role; group routes resolve the role inside the group. */
  role: Role;
  rateLimit?: RateLimitKind;
  /** Skips the session lookup on the public, cacheable groups list. */
  anonymous?: boolean;
  /** Allowed while the user still has to accept a new policy version (Q18). */
  consentExempt?: boolean;
  /** Suggesting and voting need membership (or ownership); a platform admin outside the group can only manage it. */
  participate?: boolean;
  run: Handler;
}

const paramPatterns: Record<string, RegExp> = {
  groupId: /^[a-z0-9]{3,32}$/,
  userId: /^[a-z0-9]{8,32}$/,
  materialId: /^[1-9]\d{0,15}$/,
  roundId: /^[1-9]\d{0,15}$/,
  requestId: /^[1-9]\d{0,15}$/,
};

/** Every API route with the minimum role it needs (D10). Tests walk this table for the route x role matrix. */
export const routes: readonly Route[] = [
  { method: 'GET', path: '/auth/login', role: 'visitor', rateLimit: 'auth', run: auth.login },
  { method: 'GET', path: '/auth/callback', role: 'visitor', rateLimit: 'auth', run: auth.callback },
  { method: 'GET', path: '/auth/signup', role: 'visitor', run: auth.getSignup },
  { method: 'POST', path: '/auth/signup', role: 'visitor', rateLimit: 'auth', run: auth.completeSignup },
  { method: 'POST', path: '/auth/signup/cancel', role: 'visitor', run: auth.cancelSignup },
  { method: 'POST', path: '/auth/logout', role: 'visitor', consentExempt: true, run: auth.logout },

  { method: 'GET', path: '/me', role: 'visitor', run: auth.getMe },
  { method: 'PATCH', path: '/me', role: 'user', run: auth.updateMe },
  { method: 'DELETE', path: '/me', role: 'user', consentExempt: true, run: auth.deleteAccount },
  { method: 'POST', path: '/me/consents', role: 'user', consentExempt: true, run: auth.acceptPolicies },
  { method: 'GET', path: '/me/groups', role: 'user', run: auth.myGroups },
  { method: 'GET', path: '/me/export', role: 'user', run: auth.exportAccount },

  { method: 'GET', path: '/groups', role: 'visitor', anonymous: true, run: groups.listPublicGroups },
  { method: 'POST', path: '/groups', role: 'user', run: groups.createGroup },
  { method: 'GET', path: '/groups/:groupId/preview', role: 'user', run: groups.previewGroup },
  { method: 'POST', path: '/groups/:groupId/join', role: 'user', rateLimit: 'join', run: groups.joinGroup },
  { method: 'GET', path: '/groups/:groupId', role: 'member', run: groups.getGroup },
  { method: 'DELETE', path: '/groups/:groupId', role: 'owner', run: groups.deleteGroup },
  { method: 'GET', path: '/groups/:groupId/members', role: 'member', run: groups.listMembers },
  { method: 'DELETE', path: '/groups/:groupId/members/:userId', role: 'owner', run: groups.removeMember },
  { method: 'POST', path: '/groups/:groupId/leave', role: 'member', run: groups.leaveGroup },
  { method: 'GET', path: '/groups/:groupId/settings', role: 'owner', run: groups.getSettings },
  { method: 'PUT', path: '/groups/:groupId/settings', role: 'owner', run: groups.updateSettings },
  { method: 'POST', path: '/groups/:groupId/access-code', role: 'owner', run: groups.rotateAccessCode },
  { method: 'GET', path: '/groups/:groupId/requests', role: 'owner', run: groups.listRequests },
  { method: 'POST', path: '/groups/:groupId/requests/:requestId/approve', role: 'owner', run: groups.approveRequest },
  { method: 'POST', path: '/groups/:groupId/requests/:requestId/reject', role: 'owner', run: groups.rejectRequest },
  { method: 'DELETE', path: '/groups/:groupId/requests/:requestId/message', role: 'owner', run: groups.deleteRequestMessage },

  { method: 'GET', path: '/groups/:groupId/materials', role: 'member', run: board.listMaterials },
  { method: 'POST', path: '/groups/:groupId/materials', role: 'member', participate: true, run: board.createMaterial },
  { method: 'GET', path: '/groups/:groupId/materials/deleted', role: 'owner', run: board.listDeletedMaterials },
  { method: 'PATCH', path: '/groups/:groupId/materials/:materialId', role: 'owner', run: board.updateMaterial },
  { method: 'DELETE', path: '/groups/:groupId/materials/:materialId', role: 'owner', run: board.deleteMaterial },
  { method: 'POST', path: '/groups/:groupId/materials/:materialId/approve', role: 'owner', run: board.approveMaterial },
  { method: 'POST', path: '/groups/:groupId/materials/:materialId/restore', role: 'owner', run: board.restoreMaterial },
  { method: 'GET', path: '/groups/:groupId/rounds/current', role: 'member', run: board.getCurrentRound },
  { method: 'POST', path: '/groups/:groupId/rounds', role: 'owner', run: board.createRound },
  { method: 'POST', path: '/groups/:groupId/rounds/:roundId/votes', role: 'member', participate: true, run: board.castVote },
  { method: 'POST', path: '/groups/:groupId/rounds/:roundId/close', role: 'owner', run: board.closeRound },
  { method: 'POST', path: '/groups/:groupId/rounds/:roundId/cancel', role: 'owner', run: board.cancelRound },

  { method: 'GET', path: '/admin/groups', role: 'platform_admin', run: groups.listAllGroups },
  { method: 'GET', path: '/admin/moderation-log', role: 'platform_admin', run: groups.moderationLog },
];

function matchRoute(method: string, segments: string[]): { route: Route; params: Record<string, string> } {
  let methodMismatch = false;
  for (const route of routes) {
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    const matches = pattern.every((part, index) => {
      if (!part.startsWith(':')) return part === segments[index];
      params[part.slice(1)] = segments[index];
      return true;
    });
    if (!matches) continue;
    // A literal segment such as /materials/deleted wins over a parameter in the same position.
    if (Object.entries(params).some(([name, value]) => !paramPatterns[name].test(value))) continue;
    if (route.method !== method) {
      methodMismatch = true;
      continue;
    }
    return { route, params };
  }
  throw methodMismatch ? new HttpError(405, 'Method not allowed') : new HttpError(404, 'Not found');
}

function baseHeaders(): Headers {
  return new Headers({
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
}

function withBaseHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of baseHeaders()) if (!headers.has(name)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

/** Same-origin API: every state-changing request needs an allowed Origin and a JSON body (CSRF, on top of SameSite=Lax). */
function checkCsrf(request: Request, allowedOrigins: readonly string[]): void {
  if (request.method === 'GET') return;
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins.includes(origin)) throw new HttpError(403, 'Forbidden');
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') ?? '')) throw new HttpError(415, 'Use a JSON body');
}

function globalFetch(input: Request | string, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}

export function createHandler(deps: StudyGroupHandlerDeps) {
  const fetcher: FetchLike = deps.fetch ?? globalFetch;
  const randomInt = deps.randomInt ?? cryptoRandomInt;
  const app: AppConfig = {
    repository: createRepository(deps.db),
    appOrigin: deps.appOrigin,
    oidc: deps.oidc,
    sessionSecret: deps.sessionSecret,
    platformAdminEmails: deps.platformAdminEmails,
    fetch: fetcher,
    getKey: createJwksProvider(deps.oidc.provider.jwksUri, fetcher, deps.cache),
    cache: deps.cache,
    clock: () => deps.now?.() ?? new Date(),
    pick: <T>(items: T[]): T => items[randomInt(items.length)],
  };

  return async function handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname !== STUDY_GROUP_API_PREFIX && !url.pathname.startsWith(`${STUDY_GROUP_API_PREFIX}/`)) throw new HttpError(404, 'Not found');
      const { route, params } = matchRoute(request.method, url.pathname.slice(STUDY_GROUP_API_PREFIX.length).split('/').filter(Boolean));
      checkCsrf(request, deps.allowedOrigins);

      const token = route.anonymous ? undefined : parseCookies(request).get(SESSION_COOKIE);
      const sessionHash = token ? await sha256Hex(token) : null;
      const user = sessionHash ? await app.repository.getSessionUser(sessionHash, app.clock().toISOString()) : null;
      const isPlatformAdmin = Boolean(user && isPlatformAdminEmail(user.email, app.platformAdminEmails));

      const limitKey = user ? `user:${user.id}` : `ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
      const kind = route.rateLimit ?? (request.method === 'GET' ? 'read' : 'write');
      if (deps.rateLimit && !(await deps.rateLimit(kind, limitKey))) throw new HttpError(429, 'Too many requests');

      if (route.role !== 'visitor' && !user) throw new HttpError(401, 'Sign in to continue');
      if (user && !user.consented && request.method !== 'GET' && !route.consentExempt) throw new HttpError(403, 'consent_required');

      const context: RequestContext = { request, url, params, user, isPlatformAdmin, sessionHash, role: resolveRole(user, isPlatformAdmin), group: null, isMember: false, app };
      if (params.groupId) {
        const group = await app.repository.getGroup(params.groupId);
        if (!group) throw new HttpError(404, 'Group not found');
        context.group = group;
        context.isMember = await app.repository.isMember(group.id, user!.id);
        context.role = resolveGroupRole(user, isPlatformAdmin, group, context.isMember);
      }
      if (!authorize(context.role, route.role)) throw new HttpError(403, 'Forbidden');
      if (route.participate && !canParticipate(context)) throw new HttpError(403, 'Forbidden');

      const result = await route.run(context as never);
      if (result instanceof Response) return withBaseHeaders(result);
      if (result === null) return new Response(null, { status: 204, headers: baseHeaders() });
      return Response.json(result.body, { status: result.status, headers: baseHeaders() });
    } catch (error) {
      if (error instanceof HttpError) return Response.json(errorBody(error), { status: error.status, headers: baseHeaders() });
      console.error('Unable to handle study group request:', error);
      return Response.json({ error: 'Internal server error' }, { status: 500, headers: baseHeaders() });
    }
  };
}
