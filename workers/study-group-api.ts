import { createHandler, type RateLimitKind } from './study-group/handler';
import type { D1Like } from './study-group/repository';

export interface Env {
  STUDY_GROUP_DB: D1Like;
  STUDY_GROUP_SANDBOX_DB: D1Like;
  STUDY_GROUP_READ_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_WRITE_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_LOGIN_RATE_LIMITER: RateLimiter;
  STUDY_GROUP_ADMIN_EMAIL?: string;
  STUDY_GROUP_ADMIN_PASSWORD_HASH?: string;
  STUDY_GROUP_SESSION_SECRET?: string;
}

interface RateLimiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

const allowedOrigins = ['https://fbrissi.dev', 'https://www.fbrissi.dev', 'https://sandbox.fbrissi.dev'];

const studyGroupApi = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const isSandbox = new URL(request.url).hostname === 'sandbox.fbrissi.dev';
    const limiters: Record<RateLimitKind, RateLimiter> = {
      read: env.STUDY_GROUP_READ_RATE_LIMITER,
      write: env.STUDY_GROUP_WRITE_RATE_LIMITER,
      login: env.STUDY_GROUP_LOGIN_RATE_LIMITER,
    };

    return createHandler({
      db: isSandbox ? env.STUDY_GROUP_SANDBOX_DB : env.STUDY_GROUP_DB,
      allowedOrigins,
      admin: {
        email: env.STUDY_GROUP_ADMIN_EMAIL ?? '',
        passwordHash: env.STUDY_GROUP_ADMIN_PASSWORD_HASH ?? '',
        sessionSecret: env.STUDY_GROUP_SESSION_SECRET ?? '',
      },
      async rateLimit(kind, limited) {
        const { success } = await limiters[kind].limit({ key: limited.headers.get('CF-Connecting-IP') || 'unknown' });
        return success;
      },
    })(request);
  },
};

export default studyGroupApi;
