import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { parseEmailAllowlist } from '../study-group/authorization';
import { NOTIFICATION_LIMITS } from '../study-group/contract';
import { createHandler } from '../study-group/handler';
import { scheduleMeetingReminders } from '../study-group/meeting-reminders';
import { createNotificationSender } from '../study-group/notification-sender';
import { createRepository, type QueuedNotification } from '../study-group/repository';
import { NOTIFICATIONS_FROM_ADDRESS, NOTIFICATIONS_REPLY_TO } from '../study-group/ses';
import { openD1Sqlite } from './d1-sqlite';
import { createFsBucket } from './fs-bucket';

const env = process.env;
const port = Number(env.STUDY_GROUP_API_PORT ?? 8788);
const databasePath = path.resolve(env.STUDY_GROUP_DB_PATH ?? 'tmp/study-group/local.sqlite');
const allowedOrigins = (env.STUDY_GROUP_ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');
const fakeIdpUrl = env.FAKE_IDP_PUBLIC_URL ?? 'http://localhost:8790';
const fakeIdpInternalUrl = env.FAKE_IDP_INTERNAL_URL ?? fakeIdpUrl;
const appOrigin = env.STUDY_GROUP_APP_ORIGIN ?? allowedOrigins[0];
const unsubscribeSecret = env.STUDY_GROUP_UNSUBSCRIBE_SECRET ?? '';

mkdirSync(path.dirname(databasePath), { recursive: true });
const db = openD1Sqlite(databasePath, path.resolve('workers/study-group/migrations'));
// Local only: group icons live in a folder next to the database instead of the R2 bucket.
const icons = createFsBucket(path.resolve(env.STUDY_GROUP_ICONS_PATH ?? 'tmp/study-group/icons'));

// Local only: notifications go to Mailpit over SMTP, sent in-process instead of through a queue.
const transporter = nodemailer.createTransport({
  host: env.MAILPIT_SMTP_HOST ?? 'mailpit',
  port: Number(env.MAILPIT_SMTP_PORT ?? 1025),
  secure: false,
});
const deliver = createNotificationSender({
  db,
  environment: 'local',
  appOrigin,
  unsubscribeSecret,
  allowlist: null,
  dailyCap: NOTIFICATION_LIMITS.defaultEmailsPerDay,
  async send(email) {
    const info = await transporter.sendMail({
      from: { name: 'English Study Groups', address: NOTIFICATIONS_FROM_ADDRESS },
      to: email.to,
      replyTo: NOTIFICATIONS_REPLY_TO,
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: email.headers,
    });
    return { messageId: info.messageId };
  },
});

// Due emails are sent right away; a later one is sent by a timer at its time (lost on restart).
async function notify(notifications: QueuedNotification[]): Promise<void> {
  for (const { id, sendAfter } of notifications) {
    const delay = Date.parse(sendAfter) - Date.now();
    if (delay > 0) setTimeout(() => void deliver(id).catch((error: unknown) => console.error('Unable to send study group notification', id, error)), delay).unref();
    else await deliver(id);
  }
}

const runMeetingReminders = () => scheduleMeetingReminders(createRepository(db), notify, new Date());

// The hourly cron of the deployed Worker ("7 * * * *"): a timer that fires at minute 7 of every hour.
function scheduleHourlyReminders(): void {
  const next = new Date();
  next.setUTCMinutes(7, 0, 0);
  if (next.getTime() <= Date.now()) next.setUTCHours(next.getUTCHours() + 1);
  setTimeout(() => {
    void runMeetingReminders().catch((error: unknown) => console.error('Unable to schedule meeting reminders', error));
    scheduleHourlyReminders();
  }, next.getTime() - Date.now()).unref();
}
scheduleHourlyReminders();

// Local only: sign-in goes to the fake Google IdP (workers/local/fake-idp.ts). The browser reaches it on its public URL,
// while this container calls the token and JWKS endpoints on the Docker network.
const handler = createHandler({
  db,
  allowedOrigins,
  appOrigin,
  oidc: {
    provider: {
      issuers: [fakeIdpUrl],
      authorizationEndpoint: `${fakeIdpUrl}/authorize`,
      tokenEndpoint: `${fakeIdpInternalUrl}/token`,
      jwksUri: `${fakeIdpInternalUrl}/jwks`,
    },
    clientId: env.FAKE_IDP_CLIENT_ID ?? 'local-study-groups',
    clientSecret: env.FAKE_IDP_CLIENT_SECRET ?? 'local-study-groups-secret',
  },
  sessionSecret: env.STUDY_GROUP_SESSION_SECRET ?? '',
  platformAdminEmails: parseEmailAllowlist(env.STUDY_GROUP_PLATFORM_ADMIN_EMAILS),
  environment: 'local',
  unsubscribeSecret,
  icons,
  notify,
});

createServer(async (request, response) => {
  // Local only, on the Docker network (not proxied by the app): runs the hourly reminder scan now, for E2E and
  // `kool run meeting-reminders`.
  if (request.method === 'POST' && request.url === '/__local/meeting-reminders') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ queued: await runMeetingReminders() }));
    return;
  }
  const body = await readBody(request);
  const result = await handler(new Request(`http://localhost:${port}${request.url}`, {
    method: request.method,
    headers: request.headers as HeadersInit,
    // Bytes, not text: icon uploads are binary.
    body: body.length ? body : undefined,
  }));
  const headers: Record<string, string | string[]> = Object.fromEntries(result.headers);
  const cookies = result.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies;
  response.writeHead(result.status, headers);
  response.end(Buffer.from(await result.arrayBuffer()));
}).listen(port, () => console.log(`Study group API listening on ${port}`));

async function readBody(request: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return new Uint8Array(Buffer.concat(chunks));
}
