import { STUDY_GROUP_API_PREFIX } from './contract';
import { signValue, verifySignedValue } from './crypto';

/** Links in old emails keep working for a year. */
export const UNSUBSCRIBE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

interface UnsubscribeClaims {
  sub: string;
  env: string;
  purpose: 'unsubscribe';
}

/**
 * Stateless one-click unsubscribe token (RFC 8058), signed with STUDY_GROUP_UNSUBSCRIBE_SECRET. The environment is
 * part of the signed claims, so a sandbox link never changes a production preference.
 */
export async function createUnsubscribeToken(userId: string, environment: string, secret: string, now: Date): Promise<string> {
  const claims: UnsubscribeClaims = { sub: userId, env: environment, purpose: 'unsubscribe' };
  return signValue(claims, secret, new Date(now.getTime() + UNSUBSCRIBE_TTL_MS));
}

/** Returns the user ID of a valid token for this environment, or null. */
export async function verifyUnsubscribeToken(token: string, environment: string, secret: string, now: Date): Promise<string | null> {
  const claims = await verifySignedValue<Partial<UnsubscribeClaims>>(token, secret, now);
  if (!claims || claims.purpose !== 'unsubscribe' || claims.env !== environment || typeof claims.sub !== 'string') return null;
  return claims.sub;
}

/** The List-Unsubscribe POST target (API) and the confirmation page linked from the email body. */
export function unsubscribeUrls(appOrigin: string, token: string): { oneClick: string; page: string } {
  const query = `?t=${encodeURIComponent(token)}`;
  return { oneClick: `${appOrigin}${STUDY_GROUP_API_PREFIX}/unsubscribe${query}`, page: `${appOrigin}/study-groups/unsubscribe${query}` };
}
