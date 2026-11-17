import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import path from 'node:path';
import { parseEmailAllowlist } from '../study-group/authorization';
import { createHandler } from '../study-group/handler';
import { openD1Sqlite } from './d1-sqlite';

const env = process.env;
const port = Number(env.STUDY_GROUP_API_PORT ?? 8788);
const databasePath = path.resolve(env.STUDY_GROUP_DB_PATH ?? 'tmp/study-group/local.sqlite');
const allowedOrigins = (env.STUDY_GROUP_ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');
const fakeIdpUrl = env.FAKE_IDP_PUBLIC_URL ?? 'http://localhost:8790';
const fakeIdpInternalUrl = env.FAKE_IDP_INTERNAL_URL ?? fakeIdpUrl;

mkdirSync(path.dirname(databasePath), { recursive: true });

// Local only: sign-in goes to the fake Google IdP (workers/local/fake-idp.ts). The browser reaches it on its public URL,
// while this container calls the token and JWKS endpoints on the Docker network.
const handler = createHandler({
  db: openD1Sqlite(databasePath, path.resolve('workers/study-group/migrations')),
  allowedOrigins,
  appOrigin: env.STUDY_GROUP_APP_ORIGIN ?? allowedOrigins[0],
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
});

createServer(async (request, response) => {
  const body = await readBody(request);
  const result = await handler(new Request(`http://localhost:${port}${request.url}`, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body: body || undefined,
  }));
  const headers: Record<string, string | string[]> = Object.fromEntries(result.headers);
  const cookies = result.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies;
  response.writeHead(result.status, headers);
  response.end(Buffer.from(await result.arrayBuffer()));
}).listen(port, () => console.log(`Study group API listening on ${port}`));

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}
