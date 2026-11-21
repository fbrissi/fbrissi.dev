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

const avatarColors = ['#1a73e8', '#188038', '#e37400', '#a142f4', '#d93025'];

const pageStyles = `
:root{color-scheme:light dark;--bg:#f0f4f9;--card:#fff;--text:#1f1f1f;--muted:#5f6368;--line:#dadce0;--hover:#f1f3f4;--accent:#0b57d0;--accent-text:#fff;--warn-bg:#fef7e0;--warn:#8a5300}
@media (prefers-color-scheme:dark){:root{--bg:#131314;--card:#1e1f20;--text:#e3e3e3;--muted:#9aa0a6;--line:#3c4043;--hover:#28292a;--accent:#a8c7fa;--accent-text:#062e6f;--warn-bg:#3d2e00;--warn:#fdd663}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:440px;background:var(--card);border-radius:28px;padding:36px 32px 28px}
.badge{display:inline-block;margin-bottom:16px;padding:2px 10px;border-radius:999px;background:var(--warn-bg);color:var(--warn);font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
h1{margin:0 0 4px;font-size:26px;font-weight:400}
.lead{margin:0 0 24px;color:var(--muted)}
.accounts{list-style:none;margin:0 0 24px;padding:0;border-top:1px solid var(--line)}
.accounts li{border-bottom:1px solid var(--line)}
.account{display:flex;align-items:center;gap:14px;width:100%;padding:12px 8px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:8px}
.account:hover,.account:focus-visible{background:var(--hover);outline:none}
.avatar{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;color:#fff;font-weight:600}
.who{flex:1;min-width:0}
.who strong{display:block;font-weight:500}
.who span{display:block;color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis}
.tag{flex:none;padding:1px 8px;border-radius:999px;background:var(--warn-bg);color:var(--warn);font-size:11px;font-weight:600}
.divider{display:flex;align-items:center;gap:12px;margin:0 0 16px;color:var(--muted);font-size:13px}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--line)}
.custom{display:grid;gap:12px}
label{display:grid;gap:4px;font-size:13px;color:var(--muted)}
input{padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--text);font:inherit}
input:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:transparent}
.primary{justify-self:end;margin-top:4px;padding:10px 24px;border:0;border-radius:999px;background:var(--accent);color:var(--accent-text);font:inherit;font-weight:500;cursor:pointer}
.primary:hover{filter:brightness(1.08)}
footer{margin-top:24px;color:var(--muted);font-size:12px;text-align:center}
@media (max-width:480px){main{padding:28px 20px 24px;border-radius:20px}}`;

function authorizePage(params: URLSearchParams, users: FakeUser[]): Response {
  const hidden = authorizeParams.map((name) => `<input type="hidden" name="${name}" value="${escapeHtml(params.get(name) ?? '')}">`).join('');
  const accounts = users.map((user, index) => {
    const label = `Sign in as ${escapeHtml(user.name)} (${escapeHtml(user.email)})`;
    const tag = user.emailVerified ? '' : '<span class="tag">Unverified email</span>';
    return `<li><form method="post" action="/authorize">${hidden}<input type="hidden" name="sub" value="${escapeHtml(user.sub)}">`
      + `<button class="account" type="submit" aria-label="${label}">`
      + `<span class="avatar" style="background:${avatarColors[index % avatarColors.length]}" aria-hidden="true">${escapeHtml(user.givenName.charAt(0))}</span>`
      + `<span class="who"><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></span>${tag}</button></form></li>`;
  }).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fake Google sign-in</title><style>${pageStyles}</style></head><body><main>
<span class="badge">Local development only</span>
<h1>Choose an account</h1><p class="lead">Fake Google sign-in for the study groups app. Pick a test user or sign in as anyone.</p>
<ul class="accounts">${accounts}</ul>
<p class="divider">or use another account</p>
<form class="custom" method="post" action="/authorize">${hidden}
<label>Email <input name="email" type="email" autocomplete="off" placeholder="someone@example.test" required></label>
<label>Name <input name="name" autocomplete="off" placeholder="Someone Example" required></label>
<button class="primary" type="submit">Sign in as this user</button></form>
<footer>No real Google account is used. Tokens are signed with a key generated at startup.</footer>
</main></body></html>`;
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
