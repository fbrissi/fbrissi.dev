const encoder = new TextEncoder();
const decoder = new TextDecoder();
const idAlphabet = 'abcdefghjkmnpqrstuvwxyz23456789';

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

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Random string over an unambiguous lowercase alphabet, used for group IDs, user IDs and access codes. */
export function randomId(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(length)), (value) => idAlphabet[value % idAlphabet.length]).join('');
}

export function cryptoRandomInt(max: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Throws on malformed input. */
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid base64url value');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
}

export function encodeText(value: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(value);
}

export function decodeText(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export async function sha256(value: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

export async function sha256Hex(value: string): Promise<string> {
  return Array.from(await sha256(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

/** Signs a JSON payload with an `exp` (seconds) claim as `<payload>.<hmac>`. */
export async function signValue(value: object, secret: string, expiresAt: Date): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ ...value, exp: Math.floor(expiresAt.getTime() / 1000) })));
  return `${payload}.${await hmac(payload, secret)}`;
}

/** Returns the payload of a value made by `signValue`, or null when it is forged, malformed or expired. */
export async function verifySignedValue<T extends object>(token: string, secret: string, now: Date): Promise<T | null> {
  if (!secret) return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;
  if (!timingSafeEqual(signature, await hmac(payload, secret))) return null;

  try {
    const claims = JSON.parse(decoder.decode(fromBase64Url(payload))) as T & { exp?: unknown };
    return typeof claims.exp === 'number' && claims.exp * 1000 > now.getTime() ? claims : null;
  } catch {
    return null;
  }
}
