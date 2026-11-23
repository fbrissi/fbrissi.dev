import { deleteSchema, ICON_LIMITS } from './contract';
import { randomId } from './crypto';
import { moderationEntry } from './group-routes';
import { IconError, readIcon } from './icon-image';
import { iconKey, ICON_PREFIX, verifyIconUrl } from './icons';
import { enqueueNotifications, HttpError, iconUrl, now, parseBody, readLimitedBody, removeIcons, type GroupContext, type RequestContext, type RouteResult } from './http';
import type { OutboxNotice } from './repository';

const DAY_MS = 24 * 60 * 60 * 1000;

function requireIcons(context: RequestContext) {
  const { icons, sessionSecret } = context.app;
  if (!icons || !sessionSecret) throw new HttpError(503, 'Group icons are not available right now');
  return icons;
}

/**
 * Owner upload (PUT with the image as the body). The content is checked, not the file name: PNG, JPEG or WebP, at most
 * 256 KB (refused before it is read in full) and 512 × 512 pixels, stored without metadata under a new key. The
 * replaced object is deleted right away.
 */
export async function uploadIcon(context: GroupContext): Promise<RouteResult> {
  const bucket = requireIcons(context);
  const { app, group, user } = context;
  if (group.ownerId !== user.id) throw new HttpError(403, 'Only the group owner can change the icon');
  const since = new Date(app.clock().getTime() - DAY_MS).toISOString();
  const uploads = await app.repository.countIconUploads(user.id, group.id, since);
  if (uploads.user >= ICON_LIMITS.uploadsPerUserPerDay || uploads.group >= ICON_LIMITS.uploadsPerGroupPerDay) {
    throw new HttpError(429, 'Too many icon uploads today. Try again tomorrow.');
  }
  const body = await readLimitedBody(context.request, ICON_LIMITS.maxBytes, 'Use an image of at most 256 KB.');
  let image;
  try {
    image = readIcon(body);
  } catch (error) {
    // readIcon only throws IconError, whose message is meant for the user.
    throw new HttpError(422, (error as IconError).message);
  }
  const icon = { key: iconKey(group.id, randomId(16), image.extension), contentType: image.contentType, updatedAt: now(context) };
  await bucket.put(icon.key, image.bytes, { httpMetadata: { contentType: image.contentType } });
  const previous = await app.repository.setGroupIcon(group.id, user.id, icon);
  await removeIcons(context, previous ? [previous] : []);
  return { status: 200, body: { iconUrl: await iconUrl(context, icon) } };
}

/**
 * The owner removes the icon; the platform admin removes it with a mandatory reason, written to the moderation log
 * and sent to the owner as an in-app notice and an email.
 */
export async function deleteIcon(context: GroupContext): Promise<RouteResult> {
  const { reason } = await parseBody(context.request, deleteSchema);
  requireIcons(context);
  const { group } = context;
  if (!group.icon) throw new HttpError(404, 'This group has no icon');
  const log = context.role === 'platform_admin'
    ? moderationEntry(context, reason, { action: 'delete_icon', targetType: 'group_icon', targetId: group.id, label: group.name })
    : undefined;
  const notice: OutboxNotice | undefined = log && group.ownerId
    ? { userId: group.ownerId, kind: 'icon_removed', groupId: group.id, dedupeKey: `icon_removed:${group.icon.key}`, payload: { groupName: group.name, reason: log.reason } }
    : undefined;
  const queued = await context.app.repository.clearGroupIcon(group.id, now(context), log, notice);
  await removeIcons(context, [group.icon.key]);
  await enqueueNotifications(context, queued);
  return null;
}

/**
 * Serves an icon from the private bucket for a valid signed URL. Every URL signed in the same hour is the same, so
 * the edge cache (Cache API) and browsers answer repeats without reading R2 again.
 */
export async function serveIcon(context: RequestContext): Promise<RouteResult> {
  const bucket = requireIcons(context);
  const { app, url, params } = context;
  const key = `${ICON_PREFIX}${params.iconGroup}/${params.iconFile}`;
  const left = await verifyIconUrl(app.sessionSecret, key, url.searchParams.get('exp'), url.searchParams.get('sig'), app.clock());
  if (left === null) throw new HttpError(403, 'This icon link is invalid or has expired');

  // Only the signed parts make the cache key, so extra query parameters can't fill the cache with copies.
  const cacheKey = new Request(`${url.origin}${url.pathname}?exp=${url.searchParams.get('exp')}&sig=${url.searchParams.get('sig')}`);
  const cached = await app.cache?.match(cacheKey);
  if (cached) return cached;
  const object = await bucket.get(key);
  if (!object) throw new HttpError(404, 'Icon not found');
  const response = new Response(await object.arrayBuffer(), {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': `public, max-age=${left}, immutable`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  });
  await app.cache?.put(cacheKey, response.clone());
  return response;
}
