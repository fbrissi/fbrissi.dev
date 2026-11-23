import { STUDY_GROUP_API_PREFIX } from './contract';
import { timingSafeEqual, toBase64Url } from './crypto';

/** The subset of the R2 bucket binding the icons use; the local stack has a filesystem version (workers/local). */
export interface BucketLike {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  delete(keys: string | string[]): Promise<unknown>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{ objects: { key: string; uploaded: Date }[]; truncated: boolean; cursor?: string }>;
}

export const ICON_PREFIX = 'groups/';
const HOUR_SECONDS = 3600;
const encoder = new TextEncoder();

export function iconKey(groupId: string, name: string, extension: string): string {
  return `${ICON_PREFIX}${groupId}/${name}.${extension}`;
}

async function signature(secret: string, key: string, expires: number): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  // A separate message domain, so an icon signature never matches any other value signed with the session secret.
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`study-group-icon\n${key}\n${expires}`))));
}

async function iconPath(secret: string, key: string, expires: number): Promise<string> {
  return `${STUDY_GROUP_API_PREFIX}/icons/${key.slice(ICON_PREFIX.length)}?exp=${expires}&sig=${await signature(secret, key, expires)}`;
}

/**
 * Same-origin URL of an icon, signed with the session secret and valid until the end of the next full hour (1 to 2
 * hours). Every URL issued in the same hour is identical, so browsers and the edge cache reuse it.
 */
export async function signIconUrl(secret: string, key: string, now: Date): Promise<string> {
  return iconPath(secret, key, (Math.floor(now.getTime() / 1000 / HOUR_SECONDS) + 2) * HOUR_SECONDS);
}

/** Every signed URL of an icon that is still valid: the one issued this hour and the one issued the hour before. */
export async function validIconUrls(secret: string, key: string, now: Date): Promise<string[]> {
  const hour = Math.floor(now.getTime() / 1000 / HOUR_SECONDS);
  return Promise.all([hour + 1, hour + 2].map((next) => iconPath(secret, key, next * HOUR_SECONDS)));
}

/** Returns the seconds left on a valid signature, or null for a forged, expired or malformed URL. */
export async function verifyIconUrl(secret: string, key: string, expires: string | null, sig: string | null, now: Date): Promise<number | null> {
  if (!secret || !expires || !sig || !/^\d{1,12}$/.test(expires)) return null;
  const left = Number(expires) - Math.floor(now.getTime() / 1000);
  if (left <= 0 || left > 2 * HOUR_SECONDS) return null;
  return timingSafeEqual(sig, await signature(secret, key, Number(expires))) ? left : null;
}

/** Deletes objects after their rows are gone; a failure is logged and left to the daily orphan cleanup. */
export async function deleteIconObjects(bucket: BucketLike | undefined, keys: string[]): Promise<void> {
  if (!bucket || !keys.length) return;
  try {
    await bucket.delete(keys);
  } catch (error) {
    console.error('Unable to delete study group icons:', keys, error instanceof Error ? error.message : error);
  }
}

/** Daily cron: deletes icon objects no group points at, older than `before` so an upload in progress is kept. */
export async function deleteOrphanIcons(bucket: BucketLike, used: Set<string>, before: Date): Promise<number> {
  const orphans: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: ICON_PREFIX, cursor });
    for (const object of page.objects) if (!used.has(object.key) && object.uploaded < before) orphans.push(object.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  // R2 deletes at most 1,000 keys per call.
  for (let index = 0; index < orphans.length; index += 1000) await bucket.delete(orphans.slice(index, index + 1000));
  return orphans.length;
}
