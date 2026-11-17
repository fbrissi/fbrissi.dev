import net from 'node:net';

const idpPort = 8790;
const idpTarget = { host: process.env.E2E_FAKE_IDP_HOST ?? 'fake-idp', port: idpPort };

function reachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

/**
 * The browser must reach the app and the fake Google IdP on `localhost` (the `__Host-` cookies are Secure, and the API
 * redirects to `http://localhost:8790`). Inside the app container's network only port 3000 is local, so this forwards
 * `localhost:8790` to the `fake-idp` container for the duration of the run.
 */
export default async function globalSetup(): Promise<(() => Promise<void>) | void> {
  if (await reachable('127.0.0.1', idpPort)) return;

  const server = net.createServer((client) => {
    const upstream = net.connect(idpTarget);
    client.pipe(upstream).pipe(client);
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(idpPort, '127.0.0.1', resolve);
  });

  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}
