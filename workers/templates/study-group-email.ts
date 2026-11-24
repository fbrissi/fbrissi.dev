import { accountNoticeKinds, BAN_RETENTION_YEARS, NOTIFICATION_LIMITS, STUDY_GROUPS_EMAIL, type MeetingReminderLead, type NotificationKind } from '../study-group/contract';
import { environmentBadge, renderEmailHtml, renderEmailText, type EmailContent } from './email-layout';
import type { StudyGroupEnvironment } from '../study-group/environment';

/**
 * English-only service emails of the study groups program (E1–E6). User-written text (group names and the picked
 * material's title) is escaped and never turned into a link; the one owner-set link is the group's http(s) meeting
 * link, in the members' reminders (E5). Requester names, join messages and material links are never included.
 */
export interface StudyGroupEmailInput {
  kind: NotificationKind;
  groupId: string;
  groupName: string;
  /** E1: pending requests counted at send time. */
  pendingCount?: number;
  /** E6: the title of the material a round picked, read at send time. */
  materialTitle?: string;
  /** E4: the platform admin's reason. */
  reason?: string;
  /** E5: the meeting a reminder is about, read from the group at send time. */
  meeting?: {
    lead: MeetingReminderLead;
    /** ISO instant the meeting starts. */
    startsAt: string;
    /** Wall-clock HH:MM in the group's time zone. */
    start: string;
    end: string;
    timezone: string;
    url: string | null;
  };
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
  /** Detail rows after the paragraphs (the meeting time and links). */
  fields?: { label: string; value: string; href?: string }[];
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
          `The group, its members, suggestions, votes, rounds and icon were deleted permanently. If you think this was a mistake, reply to this email or write to ${STUDY_GROUPS_EMAIL}.`,
        ],
        action: { label: 'Find a group', url: `${appOrigin}/study-groups` },
      };
    case 'account_banned':
      return {
        subject: 'Your English Study Groups account was banned',
        paragraphs: [
          'The platform admin banned your English Study Groups account for breaking the Terms of Use. You can no longer sign in, the groups you owned were deleted permanently, and your content is hidden from other users while the ban lasts.',
          `The ban lasts ${BAN_RETENTION_YEARS} years unless it is renewed or lifted earlier.`,
          `Reason: ${input.reason ?? ''}`,
          `If you think this is a mistake, reply to this email or write to ${STUDY_GROUPS_EMAIL}, which is also the channel for requests about your personal data.`,
        ],
        action: { label: `Email ${STUDY_GROUPS_EMAIL}`, url: `mailto:${STUDY_GROUPS_EMAIL}` },
      };
    case 'account_restored':
      return {
        subject: 'Your English Study Groups account was restored',
        paragraphs: [
          'The platform admin lifted the ban on your English Study Groups account. You can sign in again. Groups deleted during the ban stay deleted.',
        ],
        action: { label: 'Sign in', url: `${appOrigin}/study-groups/my` },
      };
    case 'meeting_reminder': {
      const meeting = input.meeting!;
      const when = meeting.lead === 'day_before' ? 'tomorrow' : 'today';
      const date = new Intl.DateTimeFormat('en-US', { timeZone: meeting.timezone, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(meeting.startsAt));
      const board = `${appOrigin}${groupPath(input.groupId)}`;
      return {
        subject: `Reminder: ${groupName} meets ${when} at ${meeting.start}`,
        paragraphs: [
          `${groupName} meets ${when}, ${date}, from ${meeting.start} to ${meeting.end} (${meeting.timezone}).`,
          meeting.url
            ? 'Use the button below to join the meeting. The materials for the meeting are on the group board.'
            : "The group doesn't have a meeting link yet. Check the group board for the materials and any news from the owner.",
        ],
        fields: [
          { label: 'When', value: `${date}, ${meeting.start} to ${meeting.end} (${meeting.timezone})` },
          ...(meeting.url ? [{ label: 'Group board', value: board, href: board }] : []),
        ],
        action: meeting.url ? { label: 'Join the meeting', url: meeting.url } : { label: 'Open the group', url: board },
      };
    }
    case 'round_started':
      return {
        subject: `A vote is open in ${groupName}`,
        paragraphs: [`The owner of ${groupName} opened a vote to pick the next topic.`, 'Open the group board to vote for the material you want to discuss.'],
        action: { label: 'Vote now', url: `${appOrigin}${groupPath(input.groupId)}` },
      };
    case 'round_picked':
      return {
        subject: `Next topic for ${groupName}: ${input.materialTitle ?? ''}`,
        paragraphs: [`The next topic for ${groupName} is: ${input.materialTitle ?? ''}`, 'Open the group board to see the material and get ready for the meeting.'],
        action: { label: 'Open the group', url: `${appOrigin}${groupPath(input.groupId)}` },
      };
    case 'round_cancelled':
      return {
        subject: `The vote in ${groupName} ended without a topic`,
        paragraphs: [`The vote in ${groupName} was closed without picking a topic.`, 'Check the group board for news from the owner.'],
        action: { label: 'Open the group', url: `${appOrigin}${groupPath(input.groupId)}` },
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

/** The study group email in the shared layout; only the slots differ by kind. */
function layout(input: StudyGroupEmailInput): EmailContent {
  const { subject, paragraphs, action, fields } = content(input);
  const note = environmentNote(input.environment);
  // Ban and restore notices ignore the email setting, so they offer no unsubscribe link.
  const accountNotice = accountNoticeKinds.includes(input.kind);
  return {
    lang: 'en',
    siteUrl: input.appOrigin,
    heading: subject,
    badge: environmentBadge(input.environment),
    preheader: paragraphs[0],
    blocks: [
      { kind: 'paragraph', text: 'Hi,' },
      ...paragraphs.map((text) => ({ kind: 'paragraph' as const, text })),
      ...(fields ? [{ kind: 'fields' as const, rows: fields }] : []),
      { kind: 'button', label: action.label, url: action.url },
      { kind: 'signature', avatarSize: 48, lines: [{ text: 'English Study Groups at fbrissi.dev', style: 'plain' }] },
      ...(note ? [{ kind: 'note' as const, text: note }] : []),
    ],
    footer: accountNotice
      ? {
        text: 'You get this email because it is about your English Study Groups account at fbrissi.dev. It is sent even if you turned service emails off.',
        links: [{ label: 'Privacy Policy', url: `${input.appOrigin}/privacy` }],
        linksOnNewLine: true,
        separator: '--',
      }
      : {
        text: 'You get this email because you have an English Study Groups account at fbrissi.dev.',
        links: [
          { label: 'Email settings', url: `${input.appOrigin}/study-groups/account` },
          { label: 'Unsubscribe', textLabel: 'Unsubscribe from these emails', url: input.unsubscribeUrl },
          { label: 'Privacy Policy', url: `${input.appOrigin}/privacy` },
        ],
        linksOnNewLine: true,
        separator: '--',
      },
  };
}

export function studyGroupEmailSubject(input: StudyGroupEmailInput): string {
  return `${prefix(input.environment)}${content(input).subject}`.replace(/[\r\n]+/g, ' ');
}

export function studyGroupEmailText(input: StudyGroupEmailInput): string {
  return renderEmailText(layout(input));
}

export function studyGroupEmailHtml(input: StudyGroupEmailInput): string {
  return renderEmailHtml(layout(input));
}
