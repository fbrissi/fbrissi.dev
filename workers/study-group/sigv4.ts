const encoder = new TextEncoder();

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

export interface SigV4Request {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
}

/** RFC 3986 encoding: everything except unreserved characters. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Byte-order comparison, as SigV4 sorts query parameters by code point. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `20150830T123600Z` */
export function amzDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export async function signingKey(secretAccessKey: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const dateKey = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, service);
  return hmac(serviceKey, 'aws4_request');
}

/**
 * AWS Signature Version 4 over WebCrypto (no SDK). Signs the given headers plus `host` and `x-amz-date`, and returns
 * the headers to send: the given ones, `x-amz-date` and `authorization` (`host` is set by fetch).
 */
export async function signRequest(request: SigV4Request, credentials: SigV4Credentials, date: Date): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const timestamp = amzDate(date);
  const dateStamp = timestamp.slice(0, 8);
  const scope = `${dateStamp}/${credentials.region}/${credentials.service}/aws4_request`;

  const headers: Record<string, string> = { host: url.host, 'x-amz-date': timestamp };
  for (const [name, value] of Object.entries(request.headers)) headers[name.toLowerCase()] = value;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim().replace(/\s+/g, ' ')}\n`).join('');
  const signedHeaders = names.join(';');

  const canonicalUri = url.pathname.split('/').map((segment) => encodeRfc3986(decodeURIComponent(segment))).join('/');
  const canonicalQuery = [...url.searchParams]
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)])
    .sort(([a, x], [b, y]) => compare(a, b) || compare(x, y))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const canonicalRequest = [request.method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, await sha256Hex(request.body)].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', timestamp, scope, await sha256Hex(canonicalRequest)].join('\n');
  const signature = hex(await hmac(await signingKey(credentials.secretAccessKey, dateStamp, credentials.region, credentials.service), stringToSign));

  const sent = Object.fromEntries(Object.entries(headers).filter(([name]) => name !== 'host'));
  return { ...sent, authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
}
