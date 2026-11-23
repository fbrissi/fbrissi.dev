// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { amzDate, signingKey, signRequest } from '@/workers/study-group/sigv4';

// AWS Signature Version 4 test suite (aws-sig-v4-test-suite): fixed credentials, region, service and clock.
const credentials = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', region: 'us-east-1', service: 'service' };
const date = new Date('2015-08-30T12:36:00Z');
const credential = 'AKIDEXAMPLE/20150830/us-east-1/service/aws4_request';
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');

describe('SigV4 signer', () => {
  it('formats the request date', () => {
    expect(amzDate(date)).toBe('20150830T123600Z');
  });

  it('derives the signing key of the AWS documentation example', async () => {
    expect(hex(await signingKey(credentials.secretAccessKey, '20150830', 'us-east-1', 'iam'))).toBe('c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9');
  });

  it.each([
    ['get-vanilla', 'GET', 'https://example.amazonaws.com/', '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31'],
    ['post-vanilla', 'POST', 'https://example.amazonaws.com/', '5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b'],
    ['get-vanilla-query-order-key-case', 'GET', 'https://example.amazonaws.com/?Param2=value2&Param1=value1', 'b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500'],
  ])('matches the %s test vector', async (_name, method, url, signature) => {
    const headers = await signRequest({ method, url, headers: {}, body: '' }, credentials, date);
    expect(headers).toEqual({
      'x-amz-date': '20150830T123600Z',
      authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=host;x-amz-date, Signature=${signature}`,
    });
  });

  it('signs extra headers, sorts repeated query keys by value and leaves host to fetch', async () => {
    const headers = await signRequest({
      method: 'POST',
      url: 'https://email.us-east-1.amazonaws.com/v2/email/outbound-emails?b=2&a=2&a=1&a=1',
      headers: { 'Content-Type': '  application/json   ' },
      body: '{}',
    }, { ...credentials, service: 'ses' }, date);
    expect(headers).not.toHaveProperty('host');
    expect(headers['content-type']).toBe('  application/json   ');
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20150830\/us-east-1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/);
    // The query order doesn't change the signature.
    const reordered = await signRequest({
      method: 'POST',
      url: 'https://email.us-east-1.amazonaws.com/v2/email/outbound-emails?a=1&a=1&a=2&b=2',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }, { ...credentials, service: 'ses' }, date);
    expect(reordered.authorization).toBe(headers.authorization);
  });

  it('encodes reserved characters in the path and query per RFC 3986', async () => {
    const sign = (url: string) => signRequest({ method: 'GET', url, headers: {}, body: '' }, credentials, date);
    expect((await sign("https://example.amazonaws.com/a'b?x=(1)*!")).authorization).toBe((await sign('https://example.amazonaws.com/a%27b?x=%281%29%2A%21')).authorization);
  });
});
