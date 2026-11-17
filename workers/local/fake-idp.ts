import { createServer, type IncomingMessage } from 'node:http';
import { encodeText, randomId, sha256, toBase64Url } from '../study-group/crypto';

/**
 * Fake Google OpenID Connect provider for the local Docker stack and the E2E tests only (D14).
 * It implements the Authorization Code flow with PKCE (S256) and signs RS256 ID tokens with a key generated at startup.
 * The production Worker never uses it: its endpoints are hard-coded to Google.
 */

export interface FakeUser {
  sub: string;
  email: string;
  name: string;
  givenName: string;
  emailVerified: boolean;
}

export const defaultUsers: FakeUser[] = [
  { sub: 'fake-admin', email: 'admin@example.test', name: 'Ada Admin', givenName: 'Ada', emailVerified: true },
  { sub: 'fake-owner', email: 'owner@example.test', name: 'Olivia Owner', givenName: 'Olivia', emailVerified: true },
  { sub: 'fake-member', email: 'member@example.test', name: 'Max Member', givenName: 'Max', emailVerified: true },
  { sub: 'fake-outsider', email: 'outsider@example.test', name: 'Oscar Outsider', givenName: 'Oscar', emailVerified: true },
  { sub: 'fake-unverified', email: 'unverified@example.test', name: 'Uma Unverified', givenName: 'Uma', emailVerified: false },
];

interface PendingCode {
  user: FakeUser;
  clientId: string;
  redirectUri: string;
  nonce: string;
  codeChallenge: string;
  expiresAt: number;
}

export interface FakeIdpOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  users?: FakeUser[];
  now?: () => number;
}

const authorizeParams = ['client_id', 'redirect_uri', 'state', 'nonce', 'code_challenge'] as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function authorizePage(params: URLSearchParams, users: FakeUser[]): Response {
  const hidden = authorizeParams.map((name) => `<input type="hidden" name="${name}" value="${escapeHtml(params.get(name) ?? '')}">`).join('');
  const buttons = users.map((user) => `<form method="post" action="/authorize">${hidden}<input type="hidden" name="sub" value="${escapeHtml(user.sub)}">`
    + `<button type="submit">Sign in as ${escapeHtml(user.name)} (${escapeHtml(user.email)})</button></form>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake Google sign-in</title></head><body>
<h1>Fake Google sign-in</h1><p>Local development only. Pick a test user or sign in as anyone.</p>${buttons}
<form method="post" action="/authorize">${hidden}<label>Email <input name="email" type="email" required></label>
<label>Name <input name="name" required></label><button type="submit">Sign in as this user</button></form></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function createFakeIdp(options: FakeIdpOptions) {
  const users = options.users ?? defaultUsers;
  const now = options.now ?? Date.now;
  const kid = `fake-${randomId(8)}`;
  const keys = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const codes = new Map<string, PendingCode>();

  async function signIdToken(claims: Record<string, unknown>): Promise<string> {
    const encode = (value: object) => toBase64Url(encodeText(JSON.stringify(value)));
    const input = `${encode({ alg: 'RS256', typ: 'JWT', kid })}.${encode(claims)}`;
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, encodeText(input)));
    return `${input}.${toBase64Url(signature)}`;
  }

  async function authorize(form: URLSearchParams): Promise<Response> {
    if (authorizeParams.some((name) => !form.get(name))) return error(400, 'invalid_request');
    if (form.get('client_id') !== options.clientId) return error(400, 'unauthorized_client');
    const email = form.get('email')?.trim().toLowerCase();
    const user = email
      ? { sub: `fake-${email}`, email, name: form.get('name')?.trim() || email, givenName: form.get('name')?.trim() || email, emailVerified: true }
      : users.find((item) => item.sub === form.get('sub'));
    if (!user) return error(400, 'unknown_user');

    const code = randomId(24);
    codes.set(code, {
      user,
      clientId: form.get('client_id')!,
      redirectUri: form.get('redirect_uri')!,
      nonce: form.get('nonce')!,
      codeChallenge: form.get('code_challenge')!,
      expiresAt: now() + 60_000,
    });
    const target = new URL(form.get('redirect_uri')!);
    target.searchParams.set('code', code);
    target.searchParams.set('state', form.get('state')!);
    return new Response(null, { status: 302, headers: { Location: target.toString() } });
  }

  async function token(form: URLSearchParams): Promise<Response> {
    const pending = codes.get(form.get('code') ?? '');
    codes.delete(form.get('code') ?? '');
    if (form.get('grant_type') !== 'authorization_code' || !pending || pending.expiresAt < now()) return error(400, 'invalid_grant');
    if (form.get('client_id') !== pending.clientId || form.get('client_secret') !== options.clientSecret) return error(401, 'invalid_client');
    if (form.get('redirect_uri') !== pending.redirectUri) return error(400, 'invalid_grant');
    if (toBase64Url(await sha256(form.get('code_verifier') ?? '')) !== pending.codeChallenge) return error(400, 'invalid_grant');

    const issuedAt = Math.floor(now() / 1000);
    const idToken = await signIdToken({
      iss: options.issuer,
      aud: pending.clientId,
      sub: pending.user.sub,
      email: pending.user.email,
      email_verified: pending.user.emailVerified,
      name: pending.user.name,
      given_name: pending.user.givenName,
      nonce: pending.nonce,
      iat: issuedAt,
      exp: issuedAt + 3600,
    });
    return Response.json({ access_token: randomId(32), token_type: 'Bearer', expires_in: 3600, scope: 'openid email profile', id_token: idToken });
  }

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/authorize') {
      if (url.searchParams.get('response_type') !== 'code' || url.searchParams.get('code_challenge_method') !== 'S256') return error(400, 'invalid_request');
      return authorizePage(url.searchParams, users);
    }
    if (request.method === 'POST' && url.pathname === '/authorize') return authorize(new URLSearchParams(await request.text()));
    if (request.method === 'POST' && url.pathname === '/token') return token(new URLSearchParams(await request.text()));
    if (request.method === 'GET' && url.pathname === '/jwks') return Response.json({ keys: [{ ...publicJwk, kid, alg: 'RS256', use: 'sig' }] });
    return error(404, 'not_found');
  };
}

export async function startFakeIdp(env: Record<string, string | undefined> = process.env): Promise<void> {
  const port = Number(env.FAKE_IDP_PORT ?? 8790);
  const handle = await createFakeIdp({
    issuer: env.FAKE_IDP_PUBLIC_URL ?? `http://localhost:${port}`,
    clientId: env.FAKE_IDP_CLIENT_ID ?? 'local-study-groups',
    clientSecret: env.FAKE_IDP_CLIENT_SECRET ?? 'local-study-groups-secret',
  });
  createServer(async (request, response) => {
    const body = await readBody(request);
    const result = await handle(new Request(`http://localhost:${port}${request.url}`, { method: request.method, body: body || undefined }));
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(await result.text());
  }).listen(port, () => console.log(`Fake Google IdP listening on ${port}`));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}
