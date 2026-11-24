import { expect, test } from '@playwright/test';

import { createGroupViaApi, freshUser, groupInput, groupUrl, sessionFor, signIn } from './support';

// e2e/features/groups.feature: the weekly meeting time in the viewer's time zone on the landing card and the join screen.
test.describe('meeting time', () => {
  test("the landing card and the join screen show the meeting time in the viewer's time zone and never the meeting link", async ({ browser }) => {
    const input = groupInput('Meeting time', { meetingDay: 'Tuesday', meetingStart: '23:00', meetingEnd: '00:30', timezone: 'America/Sao_Paulo' });
    const owner = await sessionFor(browser, freshUser('TimeOwner'));
    const { id } = await createGroupViaApi(owner, input);
    await owner.context().close();

    const local = /Meets Wednesdays, 11 AM\s*–\s*to 12:30 PM your time/;
    const groupTime = 'Group time: Tuesdays, 11 PM – Wednesday 12:30 AM (Sao Paulo)';

    const visitorContext = await browser.newContext({ timezoneId: 'Asia/Tokyo' });
    const visitor = await visitorContext.newPage();
    await visitor.goto('/study-groups');
    const card = visitor.getByRole('listitem').filter({ hasText: input.name });
    await expect(card).toContainText(local);
    await expect(card).toContainText(groupTime);
    expect(await card.textContent()).not.toContain(input.meetingUrl);
    await visitorContext.close();

    const requesterContext = await browser.newContext({ timezoneId: 'Asia/Tokyo' });
    const requester = await requesterContext.newPage();
    await signIn(requester, freshUser('TimeRequester'), groupUrl(id));
    await expect(requester.getByRole('heading', { name: 'Ask to join' })).toBeVisible();
    const main = requester.getByRole('main');
    await expect(main).toContainText(local);
    await expect(main).toContainText(groupTime);
    await expect(main).not.toContainText(input.meetingUrl ?? '');
    await requesterContext.close();
  });
});
