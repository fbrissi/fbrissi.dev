// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { cryptoRandomInt, encodeText, fromBase64Url, randomId, sha256Hex, signValue, timingSafeEqual, toBase64Url, verifySignedValue } from '@/workers/study-group/crypto';
import { createJwksProvider, exchangeCode, GOOGLE_OIDC, OidcError, verifyIdToken, type CacheLike, type OidcClient } from '@/workers/study-group/oidc';

const now = new Date(Date.UTC(2026, 10, 16, 12));
const nowSeconds = Math.floor(now.getTime() / 1000);
const client: OidcClient = {
  provider: { issuers: ['https://idp.test'], authorizationEndpoint: 'https://idp.test/authorize', tokenEndpoint: 'https://idp.test/token', jwksUri: 'https://idp.test/jwks' },
  clientId: 'client-id',
  clientSecret: 'secret',
};

const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const publicJwk = { ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'k1' };

const encode = (value: object) => toBase64Url(encodeText(JSON.stringify(value)));

async function token(claims: Record<string, unknown> = {}, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1' }) {
  const input = `${encode(header)}.${encode({
    iss: 'https://idp.test', aud: 'client-id', sub: 'sub-1', email: 'Person@Example.test', email_verified: true,
    given_name: ' Pat ', nonce: 'n1', iat: nowSeconds, exp: nowSeconds + 600, ...claims,
  })}`;
  return `${input}.${toBase64Url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, encodeText(input))))}`;
}

const getKey = vi.fn(async (kid: string) => {
  if (kid !== 'k1') throw new OidcError('Unknown signing key');
  return publicJwk as never;
});

const verify = (idToken: string, nonce = 'n1') => verifyIdToken(idToken, { client, nonce, now, getKey });

describe('crypto helpers', () => {
  it('encodes, compares and signs values', async () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('abcd', 'abc')).toBe(false);
    expect(fromBase64Url(toBase64Url(new Uint8Array([251, 255, 0])))).toEqual(new Uint8Array([251, 255, 0]));
    expect(() => fromBase64Url('a+b')).toThrow('Invalid base64url value');
    expect(randomId(12)).toMatch(/^[a-z2-9]{12}$/);
    expect(cryptoRandomInt(3)).toBeLessThan(3);
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

    const signed = await signValue({ a: 1 }, 'secret', new Date(now.getTime() + 1000));
    expect(await verifySignedValue(signed, 'secret', now)).toEqual({ a: 1, exp: nowSeconds + 1 });
    expect(await verifySignedValue(signed, 'other', now)).toBeNull();
    expect(await verifySignedValue(signed, '', now)).toBeNull();
    expect(await verifySignedValue(signed, 'secret', new Date(now.getTime() + 2000))).toBeNull();
    expect(await verifySignedValue(`${signed}.extra`, 'secret', now)).toBeNull();
    expect(await verifySignedValue('', 'secret', now)).toBeNull();

    // A correctly signed but malformed payload is rejected too.
    const key = await crypto.subtle.importKey('raw', encodeText('secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const payload = toBase64Url(encodeText('not json'));
    const mac = toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encodeText(payload))));
    expect(await verifySignedValue(`${payload}.${mac}`, 'secret', now)).toBeNull();
  });
});

describe('Google endpoints', () => {
  it('are fixed constants', () => {
    expect(GOOGLE_OIDC).toEqual({
      issuers: ['https://accounts.google.com', 'accounts.google.com'],
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
    });
    expect(Object.isFrozen(GOOGLE_OIDC)).toBe(true);
    expect(Object.isFrozen(GOOGLE_OIDC.issuers)).toBe(true);
  });
});

describe('ID token verification', () => {
  it('returns the verified identity', async () => {
    expect(await verify(await token())).toEqual({ sub: 'sub-1', email: 'person@example.test', name: 'Pat' });
    expect(await verify(await token({ given_name: undefined, name: 'Pat Doe', email_verified: 'true' }))).toMatchObject({ name: 'Pat Doe' });
    expect(await verify(await token({ given_name: '', name: undefined }))).toMatchObject({ name: '' });
    expect(await verify(await token({ aud: ['client-id', 'other'], azp: 'client-id' }))).toMatchObject({ sub: 'sub-1' });
  });

  it.each([
    ['malformed', async () => 'a.b', 'Malformed ID token'],
    ['undecodable', async () => 'a.b.c', 'Malformed ID token'],
    ['non-object segments', async () => `${toBase64Url(encodeText('[]'))}.${encode({})}.sig`, 'Malformed ID token'],
    ['another algorithm', async () => token({}, { alg: 'HS256', kid: 'k1' }), 'Unsupported token algorithm'],
    ['no key id', async () => token({}, { alg: 'RS256' }), 'Unsupported token algorithm'],
    ['an unknown key', async () => token({}, { alg: 'RS256', kid: 'other' }), 'Unknown signing key'],
    ['a bad signature', async () => `${(await token()).slice(0, -6)}AAAAAA`, 'Invalid token signature'],
    ['another issuer', async () => token({ iss: 'https://evil.test' }), 'Invalid issuer'],
    ['another audience', async () => token({ aud: 'other' }), 'Invalid audience'],
    ['another authorized party', async () => token({ aud: ['client-id', 'other'], azp: 'other' }), 'Invalid authorized party'],
    ['an expired token', async () => token({ exp: nowSeconds - 61 }), 'Token expired'],
    ['a missing expiry', async () => token({ exp: 'soon' }), 'Token expired'],
    ['a future token', async () => token({ iat: nowSeconds + 120 }), 'Token issued in the future'],
    ['a missing issued-at time', async () => token({ iat: undefined }), 'Missing issued-at time'],
    ['another nonce', async () => token({ nonce: 'n2' }), 'Invalid nonce'],
    ['a missing nonce', async () => token({ nonce: undefined }), 'Invalid nonce'],
    ['an unverified email', async () => token({ email_verified: false }), 'Email not verified'],
    ['a missing subject', async () => token({ sub: '' }), 'Missing identity claims'],
    ['a missing email', async () => token({ email: undefined }), 'Missing identity claims'],
  ])('rejects %s', async (_name, build, message) => {
    await expect(verify(await build())).rejects.toThrow(message);
  });

  it('rejects keys that are not RS256 RSA keys', async () => {
    const idToken = await token();
    for (const jwk of [{ ...publicJwk, kty: 'EC' }, { ...publicJwk, alg: 'RS512' }]) {
      await expect(verifyIdToken(idToken, { client, nonce: 'n1', now, getKey: async () => jwk as never })).rejects.toThrow('Unsupported signing key');
    }
    const withoutAlg = { ...publicJwk, alg: undefined };
    await expect(verifyIdToken(idToken, { client, nonce: 'n1', now, getKey: async () => withoutAlg as never })).resolves.toMatchObject({ sub: 'sub-1' });
  });
});

describe('token exchange', () => {
  it('posts the code with the PKCE verifier and returns the ID token', async () => {
    const fetcher = vi.fn(async () => Response.json({ id_token: 'token' }));
    await expect(exchangeCode(client, { code: 'c', codeVerifier: 'v', redirectUri: 'https://app/cb' }, fetcher)).resolves.toBe('token');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://idp.test/token');
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
      grant_type: 'authorization_code', code: 'c', code_verifier: 'v', redirect_uri: 'https://app/cb', client_id: 'client-id', client_secret: 'secret',
    });
  });

  it('fails on provider errors and responses without an ID token', async () => {
    await expect(exchangeCode(client, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }, async () => new Response('', { status: 400 }))).rejects.toThrow('Token endpoint returned 400');
    await expect(exchangeCode(client, { code: 'c', codeVerifier: 'v', redirectUri: 'r' }, async () => Response.json({}))).rejects.toThrow('Token response has no id_token');
  });
});

describe('JWKS provider', () => {
  it('caches keys in memory and in the Cache API, and refetches once for an unknown key', async () => {
    const store = new Map<string, Response>();
    const cache: CacheLike = { match: async (request) => store.get(request.url)?.clone(), put: async (request, response) => void store.set(request.url, response), delete: async (request) => store.delete(request.url) };
    const fetcher = vi.fn(async () => Response.json({ keys: [publicJwk] }));
    const getKeyCached = createJwksProvider('https://idp.test/jwks', fetcher, cache);

    expect(await getKeyCached('k1', 0)).toMatchObject({ kid: 'k1' });
    expect(await getKeyCached('k1', 1000)).toMatchObject({ kid: 'k1' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.get('https://idp.test/jwks')!.headers.get('Cache-Control')).toBe('public, max-age=3600');

    const otherIsolate = createJwksProvider('https://idp.test/jwks', fetcher, cache);
    expect(await otherIsolate('k1', 0)).toMatchObject({ kid: 'k1' });
    expect(fetcher).toHaveBeenCalledTimes(1);

    expect(await getKeyCached('k1', 3_600_001)).toMatchObject({ kid: 'k1' });
    await expect(getKeyCached('rotated', 3_600_002)).rejects.toThrow('Unknown signing key');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fails on JWKS errors', async () => {
    await expect(createJwksProvider('https://idp.test/jwks', async () => new Response('', { status: 503 }))('k1', 0)).rejects.toThrow('JWKS endpoint returned 503');
    await expect(createJwksProvider('https://idp.test/jwks', async () => Response.json({}))('k1', 0)).rejects.toThrow('JWKS has no keys');
  });
});
