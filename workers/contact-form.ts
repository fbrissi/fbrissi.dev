/**
 * Cloudflare Worker for contact form submission
 * 
 * This worker handles contact form submissions, validates Turnstile tokens,
 * and sends emails using MailChannels API.
 * 
 * Required environment variables:
 * - TURNSTILE_SECRET_KEY: Cloudflare Turnstile secret key
 * - CONTACT_EMAIL_TO: Destination email address (e.g., hello@fbrissi.dev)
 * - CONTACT_EMAIL_FROM: From email address (must be from verified domain)
 * 
 * Cloudflare Email Routing must be configured for the domain.
 */

export interface Env {
  TURNSTILE_SECRET_KEY: string;
  CONTACT_EMAIL_TO: string;
  CONTACT_EMAIL_FROM: string;
  ENVIRONMENT?: string; // 'development' or 'production'
  MAILPIT_URL?: string; // For local development
}

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  'cf-turnstile-response': string;
}

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

// CORS headers for API responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    try {
      // Parse form data
      const formData = await request.json() as ContactFormData;
      
      // Validate required fields
      if (!formData.name || !formData.email || !formData.subject || !formData.message) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Validate Turnstile token
      const turnstileToken = formData['cf-turnstile-response'];
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({ error: 'Missing captcha token' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const turnstileResult = await verifyTurnstile(
        turnstileToken,
        env.TURNSTILE_SECRET_KEY,
        request.headers.get('CF-Connecting-IP') || ''
      );

      if (!turnstileResult.success) {
        return new Response(
          JSON.stringify({ 
            error: 'Captcha verification failed',
            details: turnstileResult['error-codes']
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Send email via MailChannels or Mailpit (dev)
      const isDevEnvironment = env.ENVIRONMENT === 'development' || env.MAILPIT_URL;
      
      if (isDevEnvironment && env.MAILPIT_URL) {
        await sendEmailToMailpit(
          env.MAILPIT_URL,
          env.CONTACT_EMAIL_FROM,
          env.CONTACT_EMAIL_TO,
          formData.name,
          formData.email,
          formData.subject,
          formData.message
        );
      } else {
        await sendEmail(
          env.CONTACT_EMAIL_FROM,
          env.CONTACT_EMAIL_TO,
          formData.name,
          formData.email,
          formData.subject,
          formData.message
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Email sent successfully' }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      console.error('Error processing contact form:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  },
};

export default worker;

/**
 * Verify Cloudflare Turnstile token
 */
async function verifyTurnstile(
  token: string,
  secret: string,
  remoteip: string
): Promise<TurnstileResponse> {
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip,
      }),
    }
  );

  return await response.json() as TurnstileResponse;
}

/**
 * Send email using MailChannels API
 */
async function sendEmail(
  from: string,
  to: string,
  name: string,
  replyTo: string,
  subject: string,
  message: string
): Promise<void> {
  const emailData = {
    personalizations: [
      {
        to: [{ email: to }],
        reply_to: { email: replyTo, name },
      },
    ],
    from: {
      email: from,
      name: 'Contact Form - fbrissi.dev',
    },
    subject: `[Contact Form] ${subject}`,
    content: [
      {
        type: 'text/plain',
        value: `
New contact form submission from fbrissi.dev

Name: ${name}
Email: ${replyTo}
Subject: ${subject}

Message:
${message}

---
This message was sent via the contact form at https://fbrissi.dev/contact
`.trim(),
      },
      {
        type: 'text/html',
        value: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0a0a0a; color: #fafafa; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 15px; }
    .field strong { display: block; color: #f97316; margin-bottom: 5px; }
    .message { background: white; padding: 15px; border-left: 3px solid #f97316; margin-top: 15px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">New Contact Form Submission</h2>
  </div>
  <div class="content">
    <div class="field">
      <strong>Name:</strong>
      ${escapeHtml(name)}
    </div>
    <div class="field">
      <strong>Email:</strong>
      <a href="mailto:${escapeHtml(replyTo)}">${escapeHtml(replyTo)}</a>
    </div>
    <div class="field">
      <strong>Subject:</strong>
      ${escapeHtml(subject)}
    </div>
    <div class="message">
      <strong>Message:</strong>
      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    </div>
    <div class="footer">
      This message was sent via the contact form at <a href="https://fbrissi.dev/contact">https://fbrissi.dev/contact</a>
    </div>
  </div>
</body>
</html>
`.trim(),
      },
    ],
  };

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }
}

/**
 * Send email to Mailpit (local development)
 */
async function sendEmailToMailpit(
  mailpitUrl: string,
  from: string,
  to: string,
  name: string,
  replyTo: string,
  subject: string,
  message: string
): Promise<void> {
  // Mailpit uses standard SMTP format via its API
  const emailPayload = {
    From: { Address: from, Name: 'Contact Form - fbrissi.dev (Local)' },
    To: [{ Address: to }],
    ReplyTo: [{ Address: replyTo, Name: name }],
    Subject: `[Contact Form - LOCAL] ${subject}`,
    Text: `
New contact form submission from fbrissi.dev (LOCAL DEVELOPMENT)

Name: ${name}
Email: ${replyTo}
Subject: ${subject}

Message:
${message}

---
This message was sent via the contact form at http://localhost:3000/contact
`.trim(),
    HTML: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0a0a0a; color: #fafafa; padding: 20px; border-radius: 8px 8px 0 0; }
    .badge { display: inline-block; background: #f97316; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 10px; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 15px; }
    .field strong { display: block; color: #f97316; margin-bottom: 5px; }
    .message { background: white; padding: 15px; border-left: 3px solid #f97316; margin-top: 15px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">
      New Contact Form Submission
      <span class="badge">LOCAL DEV</span>
    </h2>
  </div>
  <div class="content">
    <div class="field">
      <strong>Name:</strong>
      ${escapeHtml(name)}
    </div>
    <div class="field">
      <strong>Email:</strong>
      <a href="mailto:${escapeHtml(replyTo)}">${escapeHtml(replyTo)}</a>
    </div>
    <div class="field">
      <strong>Subject:</strong>
      ${escapeHtml(subject)}
    </div>
    <div class="message">
      <strong>Message:</strong>
      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    </div>
    <div class="footer">
      This message was sent via the contact form at <a href="http://localhost:3000/contact">http://localhost:3000/contact</a>
    </div>
  </div>
</body>
</html>
`.trim(),
  };

  const response = await fetch(`${mailpitUrl}/api/v1/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email to Mailpit: ${error}`);
  }
}

/**
 * Escape HTML characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
