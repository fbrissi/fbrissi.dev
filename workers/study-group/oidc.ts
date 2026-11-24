import { decodeText, encodeText, fromBase64Url, sha256, toBase64Url } from './crypto';

export interface OidcProvider {
  /** Accepted `iss` values. */
  issuers: readonly string[];
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
}

/**
 * Google's fixed endpoints. The production Worker always uses these; only the local Docker stack
 * passes another provider (the fake IdP) to the handler.
 */
export const GOOGLE_OIDC: OidcProvider = Object.freeze({
  issuers: Object.freeze(['https://accounts.google.com', 'accounts.google.com']),
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
});

export const OIDC_SCOPES = 'openid email profile';

export interface OidcClient {
  provider: OidcProvider;
  clientId: string;
  clientSecret: string;
}

export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
}

export interface VerifiedIdentity {
  sub: string;
  email: string;
  name: string;
}

export class OidcError extends Error {}

type FetchLike = (input: Request | string, init?: RequestInit) => Promise<Response>;

interface Jwk {
  kid?: string;
  kty: string;
  alg?: string;
  n?: string;
  e?: string;
}

const jwksTtlSeconds = 3600;
const clockSkewSeconds = 60;

export async function pkceChallenge(verifier: string): Promise<string> {
  return toBase64Url(await sha256(verifier));
}

export function authorizationUrl(client: OidcClient, params: { redirectUri: string; state: string; nonce: string; codeChallenge: string }): string {
  const url = new URL(client.provider.authorizationEndpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: params.redirectUri,
    scope: OIDC_SCOPES,
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

export async function exchangeCode(
  client: OidcClient,
  params: { code: string; codeVerifier: string; redirectUri: string },
  fetcher: FetchLike
): Promise<string> {
  const response = await fetcher(client.provider.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    }).toString(),
  });
  if (!response.ok) throw new OidcError(`Token endpoint returned ${response.status}`);
  const body = (await response.json()) as { id_token?: unknown };
  if (typeof body.id_token !== 'string') throw new OidcError('Token response has no id_token');
  return body.id_token;
}

/** Caches the provider JWKS in the isolate and, when given, in the Cache API so most sign-ins skip the fetch. */
export function createJwksProvider(jwksUri: string, fetcher: FetchLike, cache?: CacheLike) {
  let memory: { keys: Jwk[]; expiresAt: number } | null = null;

  async function load(now: number, refresh: boolean): Promise<Jwk[]> {
    if (!refresh && memory && memory.expiresAt > now) return memory.keys;
    const cacheKey = new Request(jwksUri);
    let response = refresh ? undefined : await cache?.match(cacheKey);
    if (!response) {
      response = await fetcher(jwksUri, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new OidcError(`JWKS endpoint returned ${response.status}`);
      const body = await response.text();
      await cache?.put(cacheKey, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${jwksTtlSeconds}` } }));
      response = new Response(body);
    }
    const { keys } = (await response.json()) as { keys?: Jwk[] };
    if (!Array.isArray(keys)) throw new OidcError('JWKS has no keys');
    memory = { keys, expiresAt: now + jwksTtlSeconds * 1000 };
    return keys;
  }

  return async function getKey(kid: string, now: number): Promise<Jwk> {
    const key = (await load(now, false)).find((item) => item.kid === kid)
      ?? (await load(now, true)).find((item) => item.kid === kid);
    if (!key) throw new OidcError('Unknown signing key');
    return key;
  };
}

export type JwksProvider = ReturnType<typeof createJwksProvider>;

function decodeJson(segment: string): Record<string, unknown> {
  const value: unknown = JSON.parse(decodeText(fromBase64Url(segment)));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new OidcError('Invalid token segment');
  return value as Record<string, unknown>;
}

/** Verifies an RS256 ID token's signature and its iss, aud, azp, exp, iat, nonce and email_verified claims. */
export async function verifyIdToken(
  idToken: string,
  options: { client: OidcClient; nonce: string; now: Date; getKey: JwksProvider }
): Promise<VerifiedIdentity> {
  const [rawHeader, rawPayload, rawSignature, ...rest] = idToken.split('.');
  if (!rawHeader || !rawPayload || !rawSignature || rest.length > 0) throw new OidcError('Malformed ID token');

  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  let signature: Uint8Array<ArrayBuffer>;
  try {
    header = decodeJson(rawHeader);
    claims = decodeJson(rawPayload);
    signature = fromBase64Url(rawSignature);
  } catch {
    throw new OidcError('Malformed ID token');
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new OidcError('Unsupported token algorithm');

  const jwk = await options.getKey(header.kid, options.now.getTime());
  if (jwk.kty !== 'RSA' || (jwk.alg !== undefined && jwk.alg !== 'RS256')) throw new OidcError('Unsupported signing key');
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, encodeText(`${rawHeader}.${rawPayload}`)))) {
    throw new OidcError('Invalid token signature');
  }

  const nowSeconds = Math.floor(options.now.getTime() / 1000);
  const { client } = options;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (typeof claims.iss !== 'string' || !client.provider.issuers.includes(claims.iss)) throw new OidcError('Invalid issuer');
  if (!audiences.includes(client.clientId)) throw new OidcError('Invalid audience');
  if (audiences.length > 1 && claims.azp !== client.clientId) throw new OidcError('Invalid authorized party');
  if (typeof claims.exp !== 'number' || claims.exp + clockSkewSeconds <= nowSeconds) throw new OidcError('Token expired');
  if (typeof claims.iat !== 'number') throw new OidcError('Missing issued-at time');
  if (claims.iat - clockSkewSeconds > nowSeconds) throw new OidcError('Token issued in the future');
  if (typeof claims.nonce !== 'string' || claims.nonce !== options.nonce) throw new OidcError('Invalid nonce');
  if (claims.email_verified !== true && claims.email_verified !== 'true') throw new OidcError('Email not verified');
  if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string' || !claims.email) {
    throw new OidcError('Missing identity claims');
  }

  const name = [claims.given_name, claims.name].find((value): value is string => typeof value === 'string' && value.trim() !== '');
  return { sub: claims.sub, email: claims.email.toLowerCase(), name: name?.trim() ?? '' };
}
