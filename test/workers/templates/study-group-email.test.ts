// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { studyGroupEmailHtml, studyGroupEmailSubject, studyGroupEmailText, type StudyGroupEmailInput } from '@/workers/templates/study-group-email';

const base: StudyGroupEmailInput = {
  kind: 'join_request',
  groupId: 'gotalk1234',
  groupName: 'Go <b>Talk</b> & "friends"',
  pendingCount: 2,
  appOrigin: 'https://fbrissi.dev',
  unsubscribeUrl: 'https://fbrissi.dev/study-groups/unsubscribe?t=abc',
  environment: 'production',
};

describe('study group emails', () => {
  it('tells the owner how many requests wait, without names, and links to the settings (E1)', () => {
    expect(studyGroupEmailSubject(base)).toBe('New requests to join Go <b>Talk</b> & "friends"');
    const text = studyGroupEmailText(base);
    expect(text).toContain('2 people are waiting to join Go <b>Talk</b> & "friends".');
    expect(text).toContain('Review requests: https://fbrissi.dev/study-groups/g/gotalk1234/settings');
    expect(text).toContain('Unsubscribe from these emails: https://fbrissi.dev/study-groups/unsubscribe?t=abc');
    expect(text).toContain('Email settings: https://fbrissi.dev/study-groups/account');
    expect(text).toContain('Privacy Policy: https://fbrissi.dev/privacy');
    expect(studyGroupEmailText({ ...base, pendingCount: 1 })).toContain('1 person is waiting');
    expect(studyGroupEmailText({ ...base, pendingCount: undefined })).toContain('1 person is waiting');

    const html = studyGroupEmailHtml(base);
    expect(html).toContain('Go &lt;b&gt;Talk&lt;/b&gt; &amp; &quot;friends&quot;');
    expect(html).not.toContain('<b>Talk</b>');
    expect(html).toContain('href="https://fbrissi.dev/study-groups/g/gotalk1234/settings"');
    expect(html).toContain('href="https://fbrissi.dev/study-groups/unsubscribe?t=abc"');
    expect(html).toContain('src="https://fbrissi.dev/images/avatar.png"');
    expect(html).not.toMatch(/sandbox|local development/i);
    expect(html).toContain('background:#f97316;color:#111111;');
    expect(html).not.toContain('#2563eb');
  });

  it('tells the requester about the decision with neutral wording (E2, E3)', () => {
    const approved = { ...base, kind: 'join_approved' as const, groupName: 'Go Talk' };
    expect(studyGroupEmailSubject(approved)).toBe('You joined Go Talk');
    expect(studyGroupEmailText(approved)).toContain('Open the group: https://fbrissi.dev/study-groups/g/gotalk1234');
    const rejected = { ...base, kind: 'join_rejected' as const, groupName: 'Go Talk' };
    expect(studyGroupEmailSubject(rejected)).toBe('Your request to join Go Talk');
    expect(studyGroupEmailText(rejected)).toContain('Your request to join Go Talk was not approved.');
    expect(studyGroupEmailText(rejected)).toContain('You can ask to join this group again after 7 days');
    expect(studyGroupEmailHtml(rejected)).toContain('href="https://fbrissi.dev/study-groups"');
  });

  it('tells the owner the admin deleted the group, with the reason (E4)', () => {
    const deleted = { ...base, kind: 'group_deleted' as const, groupName: 'Go Talk', reason: 'Spam <script>' };
    expect(studyGroupEmailSubject(deleted)).toBe('Your group Go Talk was deleted');
    expect(studyGroupEmailText(deleted)).toContain('Reason: Spam <script>');
    expect(studyGroupEmailText(deleted)).toContain('were deleted permanently');
    expect(studyGroupEmailHtml(deleted)).toContain('Reason: Spam &lt;script&gt;');
    expect(studyGroupEmailText({ ...deleted, reason: undefined })).toContain('Reason: \n');
  });

  it('tells a banned user about the ban, the reason and how to contest it', () => {
    const banned = { ...base, kind: 'account_banned' as const, groupId: '', groupName: '', reason: 'Political propaganda' };
    expect(studyGroupEmailSubject(banned)).toBe('Your English Study Groups account was banned');
    const text = studyGroupEmailText(banned);
    expect(text).toContain('Reason: Political propaganda');
    expect(text).toContain('The ban lasts 2 years unless it is renewed or lifted earlier.');
    expect(text).toContain('If you think this is a mistake, reply to this email or write through the contact page');
    expect(text).toContain('Contact page: https://fbrissi.dev/contact');
    expect(studyGroupEmailText({ ...banned, reason: undefined })).toContain('Reason: \n');
  });

  it('tells a user their account was restored, without the reason', () => {
    const restored = { ...base, kind: 'account_restored' as const, groupId: '', groupName: '', reason: 'Appeal accepted' };
    expect(studyGroupEmailSubject(restored)).toBe('Your English Study Groups account was restored');
    const text = studyGroupEmailText(restored);
    expect(text).toContain('The platform admin lifted the ban on your English Study Groups account. You can sign in again. Groups deleted during the ban stay deleted.');
    expect(text).toContain('Sign in: https://fbrissi.dev/study-groups/my');
    expect(text).not.toContain('Appeal accepted');
  });

  it('tells the owner the admin removed the group icon, with the reason', () => {
    const removed = { ...base, kind: 'icon_removed' as const, groupName: 'Go Talk', reason: 'Political image' };
    expect(studyGroupEmailSubject(removed)).toBe('The icon of your group Go Talk was removed');
    expect(studyGroupEmailText(removed)).toContain('Reason: Political image');
    expect(studyGroupEmailText(removed)).toContain('Group settings: https://fbrissi.dev/study-groups/g/gotalk1234/settings');
    expect(studyGroupEmailText({ ...removed, reason: undefined })).toContain('Reason: \n');
  });

  it('marks sandbox and local emails in the subject and body, and keeps the subject on one line', () => {
    const sandbox = { ...base, environment: 'sandbox' as const, groupName: 'Line\r\nbreak' };
    expect(studyGroupEmailSubject(sandbox)).toBe('[SANDBOX] New requests to join Line break');
    expect(studyGroupEmailText(sandbox)).toContain('(This email was sent from the sandbox environment.)');
    expect(studyGroupEmailHtml(sandbox)).toContain('This email was sent from the sandbox environment.');
    const local = { ...base, environment: 'local' as const, appOrigin: 'http://localhost:3000' };
    expect(studyGroupEmailSubject(local)).toMatch(/^\[LOCAL\] /);
    expect(studyGroupEmailHtml(local)).toContain('This email was sent from local development.');
    expect(studyGroupEmailHtml(local)).toContain('src="http://localhost:3000/images/avatar.png"');
  });
});
