import { studyGroupEmailHtml, studyGroupEmailSubject, studyGroupEmailText, type StudyGroupEmailInput } from '../templates/study-group-email';
import { accountNoticeKinds, NOTIFICATION_LIMITS, type NotificationKind } from './contract';
import type { StudyGroupEnvironment } from './environment';
import { BAN_IN_FORCE, type D1Like } from './repository';
import { PermanentEmailError, type SendEmail } from './ses';
import { createUnsubscribeToken, unsubscribeUrls } from './unsubscribe';

/**
 * `done`: the row is gone (account deleted, purged), already handled, or claimed by another delivery. `{ deferSeconds }`:
 * the row must not be sent yet (a trailing digest).
 */
const NOT_BANNED = `NOT EXISTS (SELECT 1 FROM bans b WHERE b.user_id = jr.user_id AND ${BAN_IN_FORCE})`;

export type DeliveryOutcome = 'sent' | 'skipped' | 'failed' | 'done' | { deferSeconds: number };

export interface NotificationSenderDeps {
  db: D1Like;
  send: SendEmail;
  environment: StudyGroupEnvironment;
  appOrigin: string;
  unsubscribeSecret: string;
  /** Recipients allowed to get email (the sandbox testers); null allows every recipient. */
  allowlist: readonly string[] | null;
  /** Circuit breaker for the shared SES account: emails sent in the last 24 hours across all recipients. */
  dailyCap: number;
  now?: () => Date;
}

interface NotificationRow {
  id: number;
  user_id: string;
  kind: NotificationKind;
  group_id: string | null;
  payload: string;
  email: string;
  email_enabled: number | null;
}

function parsePayload(value: string): { groupName?: string; reason?: string } {
  try {
    const payload: unknown = JSON.parse(value);
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    return {};
  }
}

/**
 * Sends one outbox row. It first claims the row ('sending'), so a redelivered or re-driven message can't send it twice;
 * a claim older than 10 minutes belongs to a stopped mailer and is taken over. The recipient's email is read here, at
 * send time, and goes only to the provider: it is never logged, queued or returned. Throws on a temporary failure so
 * the queue retries, until the last attempt, which marks the row failed.
 */
export function createNotificationSender(deps: NotificationSenderDeps) {
  const { db } = deps;
  const finish = (id: number, status: 'sent' | 'skipped' | 'failed', now: string, messageId: string | null = null) =>
    db.prepare("UPDATE notifications SET status = ?, sent_at = ?, provider_message_id = ? WHERE id = ? AND status = 'sending'")
      .bind(status, status === 'sent' ? now : null, messageId, id).run();

  return async function deliver(id: number): Promise<DeliveryOutcome> {
    if (!deps.unsubscribeSecret) throw new Error('STUDY_GROUP_UNSUBSCRIBE_SECRET is not configured');
    const now = deps.now?.() ?? new Date();
    const nowIso = now.toISOString();
    const staleClaim = new Date(now.getTime() - NOTIFICATION_LIMITS.claimTimeoutMinutes * 60_000).toISOString();

    const claimed = await db.prepare(
      `UPDATE notifications SET status = 'sending', claimed_at = ?, attempts = attempts + 1
       WHERE id = ? AND send_after <= ? AND (status = 'pending' OR (status = 'sending' AND claimed_at < ?)) RETURNING attempts`
    ).bind(nowIso, id, nowIso, staleClaim).first<{ attempts: number }>();
    if (!claimed) {
      const waiting = await db.prepare("SELECT send_after FROM notifications WHERE id = ? AND status = 'pending'").bind(id).first<{ send_after: string }>();
      return waiting ? { deferSeconds: Math.ceil((Date.parse(waiting.send_after) - now.getTime()) / 1000) } : 'done';
    }

    const row = (await db.prepare(
      `SELECT n.id, n.user_id, n.kind, n.group_id, n.payload, u.email, p.email_enabled
       FROM notifications n JOIN users u ON u.id = n.user_id LEFT JOIN notification_preferences p ON p.user_id = n.user_id
       WHERE n.id = ?`
    ).bind(id).first<NotificationRow>())!;
    const skip = async (): Promise<DeliveryOutcome> => {
      await finish(row.id, 'skipped', nowIso);
      return 'skipped';
    };

    // The ban notice is about the account itself, so it goes out even with service emails turned off.
    if (row.email_enabled === 0 && !accountNoticeKinds.includes(row.kind)) return skip();
    if (deps.allowlist && !deps.allowlist.includes(row.email.toLowerCase())) return skip();
    const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
    const sent = (await db.prepare(
      `SELECT (SELECT COUNT(*) FROM notifications WHERE user_id = ? AND status = 'sent' AND sent_at > ?) AS recipient,
              (SELECT COUNT(*) FROM notifications WHERE status = 'sent' AND sent_at > ?) AS total`
    ).bind(row.user_id, dayAgo, dayAgo).first<{ recipient: number; total: number }>())!;
    if (sent.recipient >= NOTIFICATION_LIMITS.emailsPerRecipientPerDay || sent.total >= deps.dailyCap) return skip();

    const payload = parsePayload(row.payload);
    const input: StudyGroupEmailInput = {
      kind: row.kind,
      groupId: row.group_id ?? '',
      groupName: payload.groupName ?? '',
      reason: payload.reason,
      appOrigin: deps.appOrigin,
      unsubscribeUrl: '',
      environment: deps.environment,
    };
    // The owner digest (E1) counts the requests still pending now, leaving out banned users' (hidden while banned). It is dropped when none of them arrived after the
    // last digest sent for the group (they were all approved or rejected in the meantime, or already announced).
    if (row.kind === 'join_request') {
      const group = await db.prepare(
        `SELECT g.name,
           (SELECT COUNT(*) FROM join_requests jr WHERE jr.group_id = g.id AND jr.status = 'pending' AND ${NOT_BANNED}) AS pending,
           (SELECT COUNT(*) FROM join_requests jr WHERE jr.group_id = g.id AND jr.status = 'pending' AND ${NOT_BANNED} AND jr.created_at > COALESCE(
              (SELECT MAX(n.sent_at) FROM notifications n WHERE n.group_id = g.id AND n.kind = 'join_request' AND n.status = 'sent'), '')) AS fresh
         FROM groups g WHERE g.id = ? AND g.owner_id = ? AND g.deleted_at IS NULL`
      ).bind(row.group_id, row.user_id).first<{ name: string; pending: number; fresh: number }>();
      if (!group || group.fresh === 0) return skip();
      input.groupName = group.name;
      input.pendingCount = group.pending;
    }

    const urls = unsubscribeUrls(deps.appOrigin, await createUnsubscribeToken(row.user_id, deps.environment, deps.unsubscribeSecret, now));
    input.unsubscribeUrl = urls.page;
    try {
      const { messageId } = await deps.send({
        to: row.email,
        subject: studyGroupEmailSubject(input),
        text: studyGroupEmailText(input),
        html: studyGroupEmailHtml(input),
        headers: {
          'List-Unsubscribe': `<${urls.oneClick}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'Auto-Submitted': 'auto-generated',
        },
      });
      await finish(row.id, 'sent', nowIso, messageId);
      return 'sent';
    } catch (error) {
      if (error instanceof PermanentEmailError || claimed.attempts >= NOTIFICATION_LIMITS.maxDeliveryAttempts) {
        console.error('Study group notification failed', row.id, error instanceof Error ? error.message : error);
        await finish(row.id, 'failed', nowIso);
        return 'failed';
      }
      await db.prepare("UPDATE notifications SET status = 'pending' WHERE id = ? AND status = 'sending'").bind(row.id).run();
      throw error;
    }
  };
}
