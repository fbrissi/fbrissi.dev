import { parseEmailAllowlist } from './study-group/authorization';
import { createHandler, type RateLimitKind } from './study-group/handler';
import { GOOGLE_OIDC, type CacheLike } from './study-group/oidc';
import { createRepository, type D1Like } from './study-group/repository';

export interface Env {
  /** The production or the sandbox database: each environment is its own Worker with its own binding. */
  STUDY_GROUP_DB: D1Like;
  STUDY_GROUP_ENVIRONMENT?: string;
  STUDY_GROUP_READ_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_WRITE_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_LOGIN_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_JOIN_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_SESSION_SECRET?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  STUDY_GROUP_PLATFORM_ADMIN_EMAILS?: string;
}

interface RateLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

const productionOrigin = 'https://fbrissi.dev';
const sandboxOrigin = 'https://sandbox.fbrissi.dev';

/** Each environment only trusts its own pages, so sandbox code can't write to production with a production session. */
export function environmentOrigins(env: Pick<Env, 'STUDY_GROUP_ENVIRONMENT'>): { appOrigin: string; allowedOrigins: string[] } {
  return env.STUDY_GROUP_ENVIRONMENT === 'sandbox'
    ? { appOrigin: sandboxOrigin, allowedOrigins: [sandboxOrigin] }
    : { appOrigin: productionOrigin, allowedOrigins: [productionOrigin, 'https://www.fbrissi.dev'] };
}

function defaultCache(): CacheLike | undefined {
  return (globalThis.caches as unknown as { default?: CacheLike } | undefined)?.default;
}

/**
 * Entry point of the production and sandbox Workers. It always signs in with Google's fixed endpoints (GOOGLE_OIDC);
 * no binding or variable can point it at another identity provider. The fake IdP exists only in the local Docker
 * stack (workers/local).
 */
const studyGroupApi = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Session cookies are host-only, so sign-in always runs on the canonical host.
    if (url.hostname === 'www.fbrissi.dev' && url.pathname === '/api/study-group/auth/login') {
      return Response.redirect(`${productionOrigin}${url.pathname}${url.search}`, 302);
    }
    const limiters: Record<RateLimitKind, RateLimiter> = {
      read: env.STUDY_GROUP_READ_RATE_LIMITER,
      write: env.STUDY_GROUP_WRITE_RATE_LIMITER,
      auth: env.STUDY_GROUP_LOGIN_RATE_LIMITER,
      join: env.STUDY_GROUP_JOIN_RATE_LIMITER,
    };

    return createHandler({
      db: env.STUDY_GROUP_DB,
      ...environmentOrigins(env),
      oidc: {
        provider: GOOGLE_OIDC,
        clientId: env.GOOGLE_OAUTH_CLIENT_ID ?? '',
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      },
      sessionSecret: env.STUDY_GROUP_SESSION_SECRET ?? '',
      platformAdminEmails: parseEmailAllowlist(env.STUDY_GROUP_PLATFORM_ADMIN_EMAILS),
      cache: defaultCache(),
      async rateLimit(kind, key) {
        const { success } = await limiters[kind].limit({ key });
        return success;
      },
    })(request);
  },

  /** Daily retention purge (Q6) of this environment's database. */
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await createRepository(env.STUDY_GROUP_DB).purgeExpired(new Date());
  },
};

export default studyGroupApi;
