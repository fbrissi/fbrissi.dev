import { isPlatformAdminEmail } from './authorization';
import { BAN_RETENTION_YEARS, banSchema, type AdminUserListResponse } from './contract';
import { purgePublicGroups } from './group-routes';
import { enqueueNotifications, HttpError, now, parseBody, removeIcons, type RequestContext, type RouteResult, type UserContext } from './http';
import { decodeCursor, type NewModerationAction, type OutboxNotice } from './repository';

const PAGE_SIZE = 24;

/** Search by display name, exact email or user ID. Emails are matched, never returned. */
export async function listUsers(context: RequestContext): Promise<RouteResult> {
  const { app, url } = context;
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  const result = await app.repository.listUsers(query, decodeCursor(url.searchParams.get('cursor')), PAGE_SIZE);
  const users = result.items.map(({ email, ...user }) => ({ ...user, isPlatformAdmin: isPlatformAdminEmail(email, app.platformAdminEmails) }));
  return { status: 200, body: { users, nextCursor: result.nextCursor } satisfies AdminUserListResponse };
}

/** A ban record expires BAN_RETENTION_YEARS after the ban or its last renewal. */
function banExpiry(at: string): string {
  const date = new Date(at);
  date.setUTCFullYear(date.getUTCFullYear() + BAN_RETENTION_YEARS);
  return date.toISOString();
}

async function requireTarget(context: UserContext) {
  const target = await context.app.repository.getUser(context.params.userId);
  if (!target) throw new HttpError(404, 'User not found');
  return target;
}

/**
 * Bans a user with a mandatory reason: sign-in and every action are blocked, sessions end, the groups they own are
 * deleted permanently (each with the owner's E4 email), and their content elsewhere is hidden while the ban lasts.
 */
export async function banUser(context: UserContext): Promise<RouteResult> {
  const { reason } = await parseBody(context.request, banSchema);
  const target = await requireTarget(context);
  const { app, user } = context;
  if (target.id === user.id || isPlatformAdminEmail(target.email, app.platformAdminEmails)) throw new HttpError(409, 'A platform admin can’t be banned');
  if (target.banned) throw new HttpError(409, 'This user is already banned');

  const groups = await app.repository.listOwnedGroups(target.id);
  const entry = (action: string, targetType: string, targetId: string, label: string, groupId: string | null): NewModerationAction =>
    ({ actorId: user.id, ownerId: groupId ? target.id : null, action, targetType, targetId, groupId, label: label.slice(0, 120), reason });
  const logs = [
    entry('ban_user', 'user', target.id, target.displayName, null),
    ...groups.map((group) => entry('delete_group', 'group', group.id, group.name, group.id)),
  ];
  const bannedAt = now(context);
  const notices: OutboxNotice[] = [
    // The ban notice ignores the email setting: the user can't sign in to see anything in the app.
    { userId: target.id, kind: 'account_banned', groupId: null, dedupeKey: `account_banned:${target.id}:${bannedAt}`, payload: { reason }, ignoreOptOut: true },
    ...groups.map((group): OutboxNotice => ({
      userId: target.id, kind: 'group_deleted', groupId: group.id, dedupeKey: `group_deleted:${group.id}`, payload: { groupName: group.name, reason },
    })),
  ];
  const { queued, iconKeys } = await app.repository.banUser(target, reason, bannedAt, banExpiry(bannedAt), logs, notices);
  await removeIcons(context, iconKeys);
  if (groups.length) await purgePublicGroups(context);
  await enqueueNotifications(context, queued);
  return null;
}

/** Renews a ban with a new reason (logged): the ban record is kept for another BAN_RETENTION_YEARS from now. */
export async function renewBan(context: UserContext): Promise<RouteResult> {
  const { reason } = await parseBody(context.request, banSchema);
  const target = await requireTarget(context);
  if (!target.banned) throw new HttpError(409, 'This user is not banned');
  const at = now(context);
  await context.app.repository.renewBan(target.id, reason, banExpiry(at), {
    actorId: context.user.id, action: 'renew_ban', targetType: 'user', targetId: target.id, groupId: null, label: target.displayName.slice(0, 120), reason,
  }, at);
  return null;
}

/**
 * Lifts a ban (with a reason, logged); the user can sign in again and gets a short "account restored" email, even with
 * service emails off. Deleted groups stay deleted.
 */
export async function unbanUser(context: UserContext): Promise<RouteResult> {
  const { reason } = await parseBody(context.request, banSchema);
  const target = await requireTarget(context);
  if (!target.banned) throw new HttpError(409, 'This user is not banned');
  const at = now(context);
  const queued = await context.app.repository.unbanUser(target.id, {
    actorId: context.user.id, action: 'unban_user', targetType: 'user', targetId: target.id, groupId: null, label: target.displayName.slice(0, 120), reason,
  }, at, { userId: target.id, kind: 'account_restored', groupId: null, dedupeKey: `account_restored:${target.id}:${at}`, payload: {}, ignoreOptOut: true });
  await enqueueNotifications(context, queued);
  return null;
}
