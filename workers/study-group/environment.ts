export type StudyGroupEnvironment = 'production' | 'sandbox' | 'local';

export const PRODUCTION_ORIGIN = 'https://fbrissi.dev';
export const SANDBOX_ORIGIN = 'https://sandbox.fbrissi.dev';
export const LOCAL_ORIGIN = 'http://localhost:3000';

/** Each environment only trusts its own pages, so sandbox code can't write to production with a production session. */
export function environmentOrigins(env: { STUDY_GROUP_ENVIRONMENT?: string }): { appOrigin: string; allowedOrigins: string[] } {
  return env.STUDY_GROUP_ENVIRONMENT === 'sandbox'
    ? { appOrigin: SANDBOX_ORIGIN, allowedOrigins: [SANDBOX_ORIGIN] }
    : { appOrigin: PRODUCTION_ORIGIN, allowedOrigins: [PRODUCTION_ORIGIN, 'https://www.fbrissi.dev'] };
}
