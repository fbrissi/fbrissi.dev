import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import path from 'node:path';
import { createHandler } from '../study-group/handler';
import { openD1Sqlite } from './d1-sqlite';

const port = Number(process.env.STUDY_GROUP_API_PORT ?? 8788);
const databasePath = path.resolve(process.env.STUDY_GROUP_DB_PATH ?? 'tmp/study-group/local.sqlite');
const allowedOrigins = (process.env.STUDY_GROUP_ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');

mkdirSync(path.dirname(databasePath), { recursive: true });
const handler = createHandler({
  db: openD1Sqlite(databasePath, path.resolve('workers/study-group/migrations')),
  allowedOrigins,
  admin: {
    email: process.env.STUDY_GROUP_ADMIN_EMAIL ?? '',
    passwordHash: process.env.STUDY_GROUP_ADMIN_PASSWORD_HASH ?? '',
    sessionSecret: process.env.STUDY_GROUP_SESSION_SECRET ?? '',
  },
});

createServer(async (request, response) => {
  const body = await readBody(request);
  const result = await handler(new Request(`http://localhost:${port}${request.url}`, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body: body || undefined,
  }));
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(await result.text());
}).listen(port, () => console.log(`Study group API listening on ${port}`));

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}
