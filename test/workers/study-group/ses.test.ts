// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createSesSender, PermanentEmailError } from '@/workers/study-group/ses';

const email = { to: 'member@example.test', subject: 'You joined Go Talk', text: 'Text', html: '<p>Html</p>', headers: { 'List-Unsubscribe': '<https://fbrissi.dev/u>' } };
const now = () => new Date('2026-11-22T10:00:00Z');

function sender(response: Response | (() => Response)) {
  const fetch = vi.fn(async () => (typeof response === 'function' ? response() : response));
  return { fetch, send: createSesSender({ accessKeyId: 'AKID', secretAccessKey: 'secret', region: 'us-east-1', fetch, now }) };
}

describe('SES v2 sender', () => {
  it('signs a SendEmail call from notifications@ with Reply-To groups@ and the custom headers', async () => {
    const { fetch, send } = sender(Response.json({ MessageId: 'ses-1' }));
    await expect(send(email)).resolves.toEqual({ messageId: 'ses-1' });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://email.us-east-1.amazonaws.com/v2/email/outbound-emails');
    expect(init.method).toBe('POST');
    expect(init.headers['x-amz-date']).toBe('20261122T100000Z');
    expect(init.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\/20261122\/us-east-1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/);
    expect(JSON.parse(init.body as string)).toEqual({
      FromEmailAddress: 'English Study Groups <notifications@fbrissi.dev>',
      Destination: { ToAddresses: ['member@example.test'] },
      ReplyToAddresses: ['groups@fbrissi.dev'],
      Content: {
        Simple: {
          Subject: { Data: 'You joined Go Talk', Charset: 'UTF-8' },
          Body: { Text: { Data: 'Text', Charset: 'UTF-8' }, Html: { Data: '<p>Html</p>', Charset: 'UTF-8' } },
          Headers: [{ Name: 'List-Unsubscribe', Value: '<https://fbrissi.dev/u>' }],
        },
      },
    });
  });

  it('sends non-ASCII subjects as UTF-8 for SES to encode', async () => {
    const { fetch, send } = sender(Response.json({ MessageId: 'ses-3' }));
    await send({ ...email, subject: 'Grupo de inglês' });
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).Content.Simple.Subject).toEqual({ Data: 'Grupo de inglês', Charset: 'UTF-8' });
  });

  it('fails for good on errors about the message, and without the address', async () => {
    const { send } = sender(new Response('{}', { status: 400, headers: { 'x-amzn-ErrorType': 'MessageRejected:http://internal' } }));
    const error = await send(email).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PermanentEmailError);
    expect((error as Error).message).toBe('SES SendEmail failed with 400 MessageRejected');

    const fromBody = sender(Response.json({ __type: 'com.amazonaws#NotFoundException', message: 'member@example.test' }, { status: 404 }));
    const notFound = await fromBody.send(email).catch((caught: unknown) => caught);
    expect(notFound).toBeInstanceOf(PermanentEmailError);
    expect((notFound as Error).message).not.toContain('member@example.test');
  });

  it('asks for a retry on throttling, quota, server and unknown errors', async () => {
    for (const response of [
      () => new Response('', { status: 429, headers: { 'x-amzn-ErrorType': 'TooManyRequestsException' } }),
      () => Response.json({ __type: 'LimitExceededException' }, { status: 400 }),
      () => new Response('not json', { status: 500 }),
      () => Response.json({}, { status: 503 }),
      () => Response.json({ __type: 'MessageRejected' }, { status: 500 }),
    ]) {
      const error = await sender(response).send(email).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(PermanentEmailError);
    }
    expect((await sender(new Response('x', { status: 500 })).send(email).catch((caught: Error) => caught.message))).toBe('SES SendEmail failed with 500 Unknown');
  });

  it('uses the global fetch and clock by default', async () => {
    const fetch = vi.fn(async () => Response.json({ MessageId: 'ses-2' }));
    vi.stubGlobal('fetch', fetch);
    await expect(createSesSender({ accessKeyId: 'AKID', secretAccessKey: 'secret', region: 'eu-west-1' })(email)).resolves.toEqual({ messageId: 'ses-2' });
    expect(fetch).toHaveBeenCalledWith('https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails', expect.objectContaining({ method: 'POST' }));
    vi.unstubAllGlobals();
  });
});
