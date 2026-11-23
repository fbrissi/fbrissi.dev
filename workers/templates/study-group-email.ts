import { BAN_RETENTION_YEARS, NOTIFICATION_LIMITS, type NotificationKind } from '../study-group/contract';
import type { StudyGroupEnvironment } from '../study-group/environment';

/**
 * English-only service emails of the study groups program (E1–E4). User-written text (group names) is escaped and
 * never turned into a link; requester names and join messages are never included.
 */
export interface StudyGroupEmailInput {
  kind: NotificationKind;
  groupId: string;
  groupName: string;
  /** E1: pending requests counted at send time. */
  pendingCount?: number;
  /** E4: the platform admin's reason. */
  reason?: string;
  appOrigin: string;
  unsubscribeUrl: string;
  environment: StudyGroupEnvironment;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

interface Content {
  subject: string;
  /** Paragraphs; the first is the main message. */
  paragraphs: string[];
  action: { label: string; url: string };
}

const groupPath = (id: string, page = '') => `/study-groups/g/${encodeURIComponent(id)}${page}`;

function content(input: StudyGroupEmailInput): Content {
  const { groupName, appOrigin } = input;
  switch (input.kind) {
    case 'join_request': {
      const count = input.pendingCount ?? 1;
      const people = count === 1 ? '1 person is' : `${count} people are`;
      return {
        subject: `New requests to join ${groupName}`,
        paragraphs: [`${people} waiting to join ${groupName}.`, 'Open the group settings to approve or reject each request.'],
        action: { label: 'Review requests', url: `${appOrigin}${groupPath(input.groupId, '/settings')}` },
      };
    }
    case 'join_approved':
      return {
        subject: `You joined ${groupName}`,
        paragraphs: [`Your request to join ${groupName} was approved. You can now open the group board, suggest materials and vote.`],
        action: { label: 'Open the group', url: `${appOrigin}${groupPath(input.groupId)}` },
      };
    case 'join_rejected':
      return {
        subject: `Your request to join ${groupName}`,
        paragraphs: [
          `Your request to join ${groupName} was not approved.`,
          `You can ask to join this group again after ${NOTIFICATION_LIMITS.rejoinCooldownDays} days, or look for another group on the study groups page.`,
        ],
        action: { label: 'Find a group', url: `${appOrigin}/study-groups` },
      };
    case 'group_deleted':
      return {
        subject: `Your group ${groupName} was deleted`,
        paragraphs: [
          `The platform admin deleted your group ${groupName}.`,
          `Reason: ${input.reason ?? ''}`,
          'The group, its members, suggestions, votes, rounds and icon were deleted permanently. If you think this was a mistake, reply to this email or use the contact page.',
        ],
        action: { label: 'Contact page', url: `${appOrigin}/contact` },
      };
    case 'account_banned':
      return {
        subject: 'Your English Study Groups account was banned',
        paragraphs: [
          'The platform admin banned your English Study Groups account for breaking the Terms of Use. You can no longer sign in, the groups you owned were deleted permanently, and your content is hidden from other users while the ban lasts.',
          `The ban lasts ${BAN_RETENTION_YEARS} years unless it is renewed or lifted earlier.`,
          `Reason: ${input.reason ?? ''}`,
          'If you think this is a mistake, reply to this email or write through the contact page, which is also the channel for requests about your personal data.',
        ],
        action: { label: 'Contact page', url: `${appOrigin}/contact` },
      };
    case 'account_restored':
      return {
        subject: 'Your English Study Groups account was restored',
        paragraphs: [
          'The platform admin lifted the ban on your English Study Groups account. You can sign in again. Groups deleted during the ban stay deleted.',
        ],
        action: { label: 'Sign in', url: `${appOrigin}/study-groups/my` },
      };
    case 'icon_removed':
      return {
        subject: `The icon of your group ${groupName} was removed`,
        paragraphs: [
          `The platform admin removed the icon of your group ${groupName}. The image was deleted permanently.`,
          `Reason: ${input.reason ?? ''}`,
          'You can upload a new icon that follows the content policy in the group settings.',
        ],
        action: { label: 'Group settings', url: `${appOrigin}${groupPath(input.groupId, '/settings')}` },
      };
  }
}

function prefix(environment: StudyGroupEnvironment): string {
  if (environment === 'sandbox') return '[SANDBOX] ';
  if (environment === 'local') return '[LOCAL] ';
  return '';
}

function environmentNote(environment: StudyGroupEnvironment): string | null {
  if (environment === 'sandbox') return 'This email was sent from the sandbox environment.';
  if (environment === 'local') return 'This email was sent from local development.';
  return null;
}

function footer(input: StudyGroupEmailInput) {
  return {
    reason: 'You get this email because you have an English Study Groups account at fbrissi.dev.',
    account: `${input.appOrigin}/study-groups/account`,
    privacy: `${input.appOrigin}/privacy`,
    unsubscribe: input.unsubscribeUrl,
  };
}

export function studyGroupEmailSubject(input: StudyGroupEmailInput): string {
  return `${prefix(input.environment)}${content(input).subject}`.replace(/[\r\n]+/g, ' ');
}

export function studyGroupEmailText(input: StudyGroupEmailInput): string {
  const { paragraphs, action } = content(input);
  const links = footer(input);
  const note = environmentNote(input.environment);
  return [
    'Hi,',
    ...paragraphs,
    `${action.label}: ${action.url}`,
    'English Study Groups at fbrissi.dev',
    ...(note ? [`(${note})`] : []),
    `--\n${links.reason}\nEmail settings: ${links.account}\nUnsubscribe from these emails: ${links.unsubscribe}\nPrivacy Policy: ${links.privacy}`,
  ].join('\n\n');
}

export function studyGroupEmailHtml(input: StudyGroupEmailInput): string {
  const { paragraphs, action } = content(input);
  const links = footer(input);
  const note = environmentNote(input.environment);
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const avatarUrl = `${input.appOrigin}/images/avatar.png`;
  const body = paragraphs.map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph)}</p>`).join('\n        ');
  const button = `<p style="margin:8px 0 28px;"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#f97316;color:#111111;text-decoration:none;font-size:14px;">${escapeHtml(action.label)}</a></p>`;
  const noteHtml = note ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#666666;">${note}</p>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#ffffff;">
    <tr>
      <td style="padding:24px 20px;font-family:${font};font-size:15px;line-height:1.6;color:#222222;">
        <p style="margin:0 0 16px;">Hi,</p>
        ${body}
        ${button}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td valign="middle" style="padding:0 14px 0 0;">
              <img src="${avatarUrl}" alt="" width="48" height="48" style="display:block;width:48px;height:auto;border:0;border-radius:24px;">
            </td>
            <td valign="middle" style="font-family:${font};font-size:14px;line-height:1.45;color:#444444;">English Study Groups at fbrissi.dev</td>
          </tr>
        </table>
        ${noteHtml}
        <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.5;color:#888888;">
          ${links.reason}<br>
          <a href="${escapeHtml(links.account)}" style="color:#c2410c;text-decoration:none;">Email settings</a> ·
          <a href="${escapeHtml(links.unsubscribe)}" style="color:#c2410c;text-decoration:none;">Unsubscribe</a> ·
          <a href="${escapeHtml(links.privacy)}" style="color:#c2410c;text-decoration:none;">Privacy Policy</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (character) => entities[character]);
}
