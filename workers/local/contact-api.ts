import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { createServer, type IncomingMessage } from 'node:http';
import type { ContactFormRequest } from '../contact-message';
import { getContactQueueUrl, sqs } from './queue';

const port = Number(process.env.CONTACT_API_PORT ?? 8787);

async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/api/contact') {
    return json({ error: 'Not found' }, 404);
  }

  try {
    const form = await request.json() as ContactFormRequest;
    if (!isValidForm(form)) return json({ error: 'Invalid form submission' }, 400);

    await sqs.send(new SendMessageCommand({
      QueueUrl: await getContactQueueUrl(),
      MessageBody: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      }),
    }));

    return json({ success: true, message: 'Message queued successfully' }, 202);
  } catch (error) {
    console.error('Unable to queue contact form submission:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}

createServer(async (request, response) => {
  const body = await readBody(request);
  const result = await handler(new Request(`http://localhost:${port}${request.url}`, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body: body || undefined,
  }));
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(await result.text());
}).listen(port, () => console.log(`Contact API listening on ${port}`));

function isValidForm(form: Partial<ContactFormRequest>): form is ContactFormRequest {
  return Boolean(form.name?.trim() && form.email?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.subject?.trim() && form.message?.trim() && form['cf-turnstile-response']);
}

const corsHeaders = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
function json(body: object, status: number): Response { return Response.json(body, { status, headers: corsHeaders }); }

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}
