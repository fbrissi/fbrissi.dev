import { resolveContactLocale, type ContactFormRequest, type ContactMessage } from './contact-message';

export interface Env {
  CONTACT_FORM_QUEUE: { send: (message: ContactMessage) => Promise<void> };
  CONTACT_FORM_IP_RATE_LIMITER: RateLimiter;
  CONTACT_FORM_EMAIL_RATE_LIMITER: RateLimiter;
  TURNSTILE_SECRET_KEY: string;
}

interface RateLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

interface TurnstileResponse {
  success: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://fbrissi.dev',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const contactApi = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
      const form = await request.json() as ContactFormRequest;
      if (!isValidForm(form)) return json({ error: 'Invalid form submission' }, 400);

      const ip = request.headers.get('CF-Connecting-IP') ?? '';
      const [ipLimit, emailLimit] = await Promise.all([
        env.CONTACT_FORM_IP_RATE_LIMITER.limit({ key: ip || 'unknown' }),
        env.CONTACT_FORM_EMAIL_RATE_LIMITER.limit({ key: normalizeEmail(form.email) }),
      ]);
      if (!ipLimit.success || !emailLimit.success) {
        return json({ error: 'Too many submissions' }, 429);
      }

      const turnstile = await verifyTurnstile(
        form['cf-turnstile-response'],
        env.TURNSTILE_SECRET_KEY,
        ip
      );
      if (!turnstile.success) return json({ error: 'Captcha verification failed' }, 400);

      await env.CONTACT_FORM_QUEUE.send({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        locale: resolveContactLocale(form.locale),
      });

      return json({ success: true, message: 'Message queued successfully' }, 202);
    } catch (error) {
      console.error('Unable to queue contact form submission:', error);
      return json({ error: 'Internal server error' }, 500);
    }
  },
};

export default contactApi;

function isValidForm(form: Partial<ContactFormRequest>): form is ContactFormRequest {
  return Boolean(
    form.name?.trim() &&
    form.email?.trim() &&
    /^[^\s@<>(),;:"[\]]+@[^\s@<>(),;:"[\]]+\.[^\s@<>(),;:"[\]]+$/.test(form.email) &&
    form.subject?.trim() &&
    form.message?.trim() &&
    form['cf-turnstile-response']
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function verifyTurnstile(token: string, secret: string, remoteip: string): Promise<TurnstileResponse> {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip }),
  });

  return response.json() as Promise<TurnstileResponse>;
}

function json(body: object, status: number): Response {
  return Response.json(body, { status, headers: corsHeaders });
}
