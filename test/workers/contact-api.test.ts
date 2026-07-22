import { afterEach, describe, expect, it, vi } from 'vitest';
import contactApi from '@/workers/contact-api';

const corsHeaders = {
  'access-control-allow-origin': 'https://fbrissi.dev',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
};

const validForm = {
  name: '  Ada Lovelace  ',
  email: 'ada@example.com',
  subject: '  Hello  ',
  message: '  Test message  ',
  'cf-turnstile-response': 'captcha-token',
  locale: 'en',
};

function createEnv() {
    return {
      CONTACT_FORM_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
      CONTACT_FORM_SANDBOX_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
    CONTACT_FORM_IP_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    CONTACT_FORM_EMAIL_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
  };
}

async function expectJson(response: Response, status: number, body: object) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual(body);
  expect(Object.fromEntries(response.headers)).toMatchObject(corsHeaders);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('contact API worker', () => {
  it('responds to CORS preflight requests', async () => {
    const response = await contactApi.fetch(new Request('https://api.example.com/contact', { method: 'OPTIONS' }), createEnv());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(Object.fromEntries(response.headers)).toEqual(corsHeaders);
  });

  it('rejects methods other than POST', async () => {
    const response = await contactApi.fetch(new Request('https://api.example.com/contact', { method: 'GET' }), createEnv());

    await expectJson(response, 405, { error: 'Method not allowed' });
  });

  it.each([
    ['a missing name', { ...validForm, name: '' }],
    ['a whitespace-only name', { ...validForm, name: '   ' }],
    ['a missing email', { ...validForm, email: '' }],
    ['an invalid email address', { ...validForm, email: 'not-an-email' }],
    ['an email address with header delimiters', { ...validForm, email: 'ada@example.com>' }],
    ['a missing subject', { ...validForm, subject: '' }],
    ['a whitespace-only message', { ...validForm, message: '  ' }],
    ['a missing captcha token', { ...validForm, 'cf-turnstile-response': '' }],
  ])('rejects a submission with %s before verifying the captcha', async (_description, form) => {
    const verify = vi.fn();
    vi.stubGlobal('fetch', verify);
    const env = createEnv();

    const response = await contactApi.fetch(new Request('https://api.example.com/contact', {
      method: 'POST',
      body: JSON.stringify(form),
    }), env);

    await expectJson(response, 400, { error: 'Invalid form submission' });
    expect(verify).not.toHaveBeenCalled();
    expect(env.CONTACT_FORM_QUEUE.send).not.toHaveBeenCalled();
  });

  it('rejects submissions when a rate limit is exceeded', async () => {
    const verify = vi.fn();
    vi.stubGlobal('fetch', verify);
    const env = createEnv();
    env.CONTACT_FORM_EMAIL_RATE_LIMITER.limit.mockResolvedValue({ success: false });

    const response = await contactApi.fetch(new Request('https://api.example.com/contact', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.42' },
      body: JSON.stringify(validForm),
    }), env);

    await expectJson(response, 429, { error: 'Too many submissions' });
    expect(env.CONTACT_FORM_IP_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: '203.0.113.42' });
    expect(env.CONTACT_FORM_EMAIL_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: 'ada@example.com' });
    expect(verify).not.toHaveBeenCalled();
    expect(env.CONTACT_FORM_QUEUE.send).not.toHaveBeenCalled();
  });

  it('verifies the captcha with the connecting IP, trims fields, and queues valid submissions', async () => {
    const verify = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal('fetch', verify);
    const env = createEnv();

    const response = await contactApi.fetch(new Request('https://api.example.com/contact', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.42' },
      body: JSON.stringify(validForm),
    }), env);

    await expectJson(response, 202, { success: true, message: 'Message queued successfully' });
    expect(verify).toHaveBeenCalledWith('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'turnstile-secret', response: 'captcha-token', remoteip: '203.0.113.42' }),
    });
    expect(env.CONTACT_FORM_IP_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: '203.0.113.42' });
    expect(env.CONTACT_FORM_EMAIL_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: 'ada@example.com' });
    expect(env.CONTACT_FORM_QUEUE.send).toHaveBeenCalledWith({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      subject: 'Hello',
      message: 'Test message',
      locale: 'en',
      environment: 'production',
    });
  });

  it('identifies sandbox submissions and allows the sandbox origin', async () => {
    const verify = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal('fetch', verify);
    const env = createEnv();

    const response = await contactApi.fetch(new Request('https://fbrissi.dev/api/contact', {
      method: 'POST',
      headers: { Origin: 'https://sandbox.fbrissi.dev' },
      body: JSON.stringify(validForm),
    }), env);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://sandbox.fbrissi.dev');
    expect(env.CONTACT_FORM_SANDBOX_QUEUE.send).toHaveBeenCalledWith(expect.objectContaining({ environment: 'sandbox' }));
    expect(env.CONTACT_FORM_QUEUE.send).not.toHaveBeenCalled();
  });

  it('normalizes the email used for rate limiting', async () => {
    const verify = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal('fetch', verify);
    const env = createEnv();

    await contactApi.fetch(new Request('https://api.example.com/contact', {
      method: 'POST',
      body: JSON.stringify({ ...validForm, email: 'ADA@EXAMPLE.COM' }),
    }), env);

    expect(env.CONTACT_FORM_EMAIL_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: 'ada@example.com' });
  });

  it('uses an empty IP address and rejects failed captcha verification', async () => {
    const verify = vi.fn().mockResolvedValue(Response.json({ success: false }));
    vi.stubGlobal('fetch', verify);
    const env = createEnv();

    const response = await contactApi.fetch(new Request('https://api.example.com/contact', {
      method: 'POST',
      body: JSON.stringify(validForm),
    }), env);

    await expectJson(response, 400, { error: 'Captcha verification failed' });
    expect(JSON.parse(verify.mock.calls[0][1].body)).toMatchObject({ remoteip: '' });
    expect(env.CONTACT_FORM_QUEUE.send).not.toHaveBeenCalled();
  });

  it.each([
    ['the request body cannot be parsed', () => new Request('https://api.example.com/contact', { method: 'POST', body: '{' })],
    ['Turnstile verification fails', () => new Request('https://api.example.com/contact', { method: 'POST', body: JSON.stringify(validForm) })],
    ['queue delivery fails', () => new Request('https://api.example.com/contact', { method: 'POST', body: JSON.stringify(validForm) })],
  ])('returns an internal error when %s', async (_description, createRequest) => {
    const error = new Error('unexpected failure');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = createEnv();

    if (_description === 'Turnstile verification fails') vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    if (_description === 'queue delivery fails') {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true })));
      env.CONTACT_FORM_QUEUE.send.mockRejectedValue(error);
    }

    const response = await contactApi.fetch(createRequest(), env);

    await expectJson(response, 500, { error: 'Internal server error' });
    expect(consoleError).toHaveBeenCalledWith(
      'Unable to queue contact form submission:',
      _description === 'the request body cannot be parsed' ? expect.any(SyntaxError) : error
    );
  });
});
