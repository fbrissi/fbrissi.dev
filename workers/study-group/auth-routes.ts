import { isPlatformAdminEmail } from './authorization';
import {
  acceptPoliciesSchema,
  deleteAccountSchema,
  LIMITS,
  signupSchema,
  updateProfileSchema,
  type CurrentUser,
  type MeResponse,
  type MyGroupsResponse,
} from './contract';
import { randomBytes, randomId, sha256Hex, signValue, timingSafeEqual, toBase64Url, verifySignedValue } from './crypto';
import {
  clearCookie,
  FLOW_TTL_MS,
  HttpError,
  NOTICE_WINDOW_MS,
  now,
  OAUTH_COOKIE,
  parseBody,
  parseCookies,
  redirect,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  setCookie,
  SIGNUP_COOKIE,
  type AppConfig,
  type RequestContext,
  type RouteResult,
  type UserContext,
} from './http';
import { purgePublicGroups } from './group-routes';
import { authorizationUrl, exchangeCode, pkceChallenge, verifyIdToken } from './oidc';

export const CALLBACK_PATH = '/api/study-group/auth/callback';
const defaultReturnTo = '/study-groups/my';
const returnToPattern = /^\/(pt-br\/)?study-groups(\/[A-Za-z0-9_-]+)*\/?$/;

interface OauthFlow {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
}

interface PendingSignup {
  sub: string;
  email: string;
  name: string;
  returnTo: string;
}

/** Only program pages on the site itself are valid post-sign-in destinations. */
export function safeReturnTo(value: string | null): string {
  return value && returnToPattern.test(value) ? value : defaultReturnTo;
}

function failure(app: AppConfig, extraCookies: string[] = []): Response {
  return redirect(`${app.appOrigin}/study-groups?signin=failed`, [clearCookie(OAUTH_COOKIE), ...extraCookies]);
}

function defaultDisplayName(name: string): string {
  return name.slice(0, LIMITS.displayName.max).trim() || 'Member';
}

async function startSession(context: RequestContext, userId: string, email: string): Promise<string> {
  const { app } = context;
  const token = toBase64Url(randomBytes(32));
  const issuedAt = app.clock();
  await app.repository.createSession(await sha256Hex(token), userId, issuedAt.toISOString(), new Date(issuedAt.getTime() + SESSION_TTL_MS).toISOString());
  if (isPlatformAdminEmail(email, app.platformAdminEmails)) await app.repository.claimUnownedGroups(userId, issuedAt.toISOString());
  return setCookie(SESSION_COOKIE, token, SESSION_TTL_MS / 1000);
}

export async function login(context: RequestContext): Promise<RouteResult> {
  const { app } = context;
  if (!app.sessionSecret || !app.oidc.clientId || !app.oidc.clientSecret) return failure(app);

  const flow: OauthFlow = {
    state: toBase64Url(randomBytes(32)),
    nonce: toBase64Url(randomBytes(32)),
    verifier: toBase64Url(randomBytes(32)),
    returnTo: safeReturnTo(context.url.searchParams.get('returnTo')),
  };
  const cookie = await signValue(flow, app.sessionSecret, new Date(app.clock().getTime() + FLOW_TTL_MS));
  const location = authorizationUrl(app.oidc, {
    redirectUri: `${app.appOrigin}${CALLBACK_PATH}`,
    state: flow.state,
    nonce: flow.nonce,
    codeChallenge: await pkceChallenge(flow.verifier),
  });
  return redirect(location, [setCookie(OAUTH_COOKIE, cookie, FLOW_TTL_MS / 1000)]);
}

/**
 * Any state, PKCE or nonce mismatch, an expired flow, or a provider error ends with the same generic failure
 * and stores nothing.
 */
export async function callback(context: RequestContext): Promise<RouteResult> {
  const { app, url } = context;
  const flow = await verifySignedValue<OauthFlow>(parseCookies(context.request).get(OAUTH_COOKIE) ?? '', app.sessionSecret, app.clock());
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  if (!flow || !code || !timingSafeEqual(state, flow.state)) return failure(app);

  let identity;
  try {
    const idToken = await exchangeCode(app.oidc, { code, codeVerifier: flow.verifier, redirectUri: `${app.appOrigin}${CALLBACK_PATH}` }, app.fetch);
    identity = await verifyIdToken(idToken, { client: app.oidc, nonce: flow.nonce, now: app.clock(), getKey: app.getKey });
  } catch (error) {
    console.warn('Study group sign-in failed:', error instanceof Error ? error.message : error);
    return failure(app);
  }

  const userId = await app.repository.findUserIdBySub(identity.sub);
  if (userId) {
    await app.repository.updateUserEmail(userId, identity.email, now(context));
    const session = await startSession(context, userId, identity.email);
    return redirect(`${app.appOrigin}${flow.returnTo}`, [clearCookie(OAUTH_COOKIE), session]);
  }

  // New users accept the Terms and Privacy Policy before the account exists (D9); nothing is stored until then.
  const signup: PendingSignup = { sub: identity.sub, email: identity.email, name: identity.name, returnTo: flow.returnTo };
  const signupCookie = await signValue(signup, app.sessionSecret, new Date(app.clock().getTime() + FLOW_TTL_MS));
  return redirect(`${app.appOrigin}/study-groups/welcome`, [clearCookie(OAUTH_COOKIE), setCookie(SIGNUP_COOKIE, signupCookie, FLOW_TTL_MS / 1000)]);
}

async function pendingSignup(context: RequestContext): Promise<PendingSignup> {
  const signup = await verifySignedValue<PendingSignup>(parseCookies(context.request).get(SIGNUP_COOKIE) ?? '', context.app.sessionSecret, context.app.clock());
  if (!signup) throw new HttpError(404, 'No pending sign-up');
  return signup;
}

export async function getSignup(context: RequestContext): Promise<RouteResult> {
  const signup = await pendingSignup(context);
  return { status: 200, body: { displayName: defaultDisplayName(signup.name) } };
}

export async function completeSignup(context: RequestContext): Promise<RouteResult> {
  const signup = await pendingSignup(context);
  await parseBody(context.request, signupSchema);
  const { repository } = context.app;

  let userId = await repository.findUserIdBySub(signup.sub);
  if (!userId) {
    userId = randomId(16);
    await repository.createUser({ id: userId, sub: signup.sub, email: signup.email, displayName: defaultDisplayName(signup.name) }, now(context));
  }
  const session = await startSession(context, userId, signup.email);
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', clearCookie(SIGNUP_COOKIE));
  headers.append('Set-Cookie', session);
  return Response.json({ returnTo: signup.returnTo }, { status: 201, headers });
}

export async function cancelSignup(): Promise<RouteResult> {
  return new Response(null, { status: 204, headers: { 'Set-Cookie': clearCookie(SIGNUP_COOKIE), 'Cache-Control': 'no-store' } });
}

export async function logout(context: RequestContext): Promise<RouteResult> {
  if (context.sessionHash) await context.app.repository.deleteSession(context.sessionHash);
  return new Response(null, { status: 204, headers: { 'Set-Cookie': clearCookie(SESSION_COOKIE), 'Cache-Control': 'no-store' } });
}

export function currentUser(context: RequestContext): CurrentUser | null {
  const { user } = context;
  return user ? { id: user.id, displayName: user.displayName, isPlatformAdmin: context.isPlatformAdmin, needsConsent: !user.consented } : null;
}

export async function getMe(context: RequestContext): Promise<RouteResult> {
  return { status: 200, body: { user: currentUser(context) } satisfies MeResponse };
}

export async function updateMe(context: UserContext): Promise<RouteResult> {
  const { displayName } = await parseBody(context.request, updateProfileSchema);
  await context.app.repository.updateDisplayName(context.user.id, displayName, now(context));
  return { status: 200, body: { user: { ...currentUser(context)!, displayName } } satisfies MeResponse };
}

export async function acceptPolicies(context: UserContext): Promise<RouteResult> {
  await parseBody(context.request, acceptPoliciesSchema);
  await context.app.repository.recordConsents(context.user.id, now(context));
  return { status: 200, body: { user: { ...currentUser(context)!, needsConsent: false } } satisfies MeResponse };
}

export async function myGroups(context: UserContext): Promise<RouteResult> {
  const { repository, clock } = context.app;
  const since = new Date(clock().getTime() - NOTICE_WINDOW_MS).toISOString();
  const [groups, pending, notices] = await Promise.all([
    repository.listMyGroups(context.user.id),
    repository.listMyPendingRequests(context.user.id),
    repository.listOwnerNotices(context.user.id, since),
  ]);
  return { status: 200, body: { groups, pending, notices } satisfies MyGroupsResponse };
}

export async function exportAccount(context: UserContext): Promise<RouteResult> {
  const data = await context.app.repository.exportAccount(context.user.id, now(context));
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="study-groups-data.json"',
      'Cache-Control': 'no-store',
    },
  });
}

export async function deleteAccount(context: UserContext): Promise<RouteResult> {
  await parseBody(context.request, deleteAccountSchema);
  await context.app.repository.deleteAccount(context.user.id, now(context));
  await purgePublicGroups(context);
  return new Response(null, { status: 204, headers: { 'Set-Cookie': clearCookie(SESSION_COOKIE), 'Cache-Control': 'no-store' } });
}
