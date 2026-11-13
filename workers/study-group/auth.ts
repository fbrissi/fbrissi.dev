const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
/** Cloudflare Workers reject PBKDF2 with more than 100k iterations. */
export const MAX_PBKDF2_ITERATIONS = 100_000;

export interface AdminCredentials {
  email: string;
  passwordHash: string;
  sessionSecret: string;
}

/** Compares two strings in time that depends only on their lengths. */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

/** Verifies a `pbkdf2-sha256$<iterations>$<saltB64>$<hashB64>` password hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, rawIterations, rawSalt, rawHash, ...rest] = stored.split('$');
  const iterations = Number(rawIterations);
  if (scheme !== 'pbkdf2-sha256' || rest.length > 0 || !Number.isInteger(iterations)
    || iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS) {
    return false;
  }

  let salt: Uint8Array<ArrayBuffer>;
  let expected: Uint8Array<ArrayBuffer>;
  try {
    salt = fromBase64(rawSalt);
    expected = fromBase64(rawHash);
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    expected.length * 8
  ));
  return timingSafeEqual(toBase64(derived), toBase64(expected));
}

/** Checks email and password with the same work whichever of them is wrong. */
export async function verifyAdminLogin(email: string, password: string, admin: AdminCredentials | undefined): Promise<boolean> {
  const emailMatches = timingSafeEqual(normalizeEmail(email), normalizeEmail(admin?.email ?? ''));
  const passwordMatches = await verifyPassword(password, admin?.passwordHash ?? '');
  return Boolean(admin?.email) && emailMatches && passwordMatches;
}

export async function createAdminToken(secret: string, now: Date): Promise<{ token: string; expiresAt: string }> {
  const expiresAt = new Date(now.getTime() + ADMIN_TOKEN_TTL_MS);
  const payload = toBase64Url(encoder.encode(JSON.stringify({ sub: 'admin', exp: Math.floor(expiresAt.getTime() / 1000) })));
  return { token: `${payload}.${await sign(payload, secret)}`, expiresAt: expiresAt.toISOString() };
}

export async function verifyAdminToken(token: string, secret: string, now: Date): Promise<boolean> {
  if (!secret) return false;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return false;
  if (!timingSafeEqual(signature, await sign(payload, secret))) return false;

  try {
    const claims = JSON.parse(decoder.decode(fromBase64Url(payload))) as { sub?: unknown; exp?: unknown };
    return claims.sub === 'admin' && typeof claims.exp === 'number' && claims.exp * 1000 > now.getTime();
  } catch {
    return false;
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  return fromBase64(value.replace(/-/g, '+').replace(/_/g, '/'));
}
