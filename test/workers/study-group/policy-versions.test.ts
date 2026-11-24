// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// A minor edit: the shown privacy version moved past the last material one.
vi.mock('@/workers/study-group/contract', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/workers/study-group/contract')>();
  return {
    ...original,
    POLICY_VERSIONS: { terms: original.POLICY_VERSIONS.terms, privacy: '2026-12-01' },
    MATERIAL_POLICY_VERSIONS: { terms: original.MATERIAL_POLICY_VERSIONS.terms, privacy: original.MATERIAL_POLICY_VERSIONS.privacy },
  };
});

const { createHarness, expectJson, request, signIn } = await import('./harness');
const { MATERIAL_POLICY_VERSIONS } = await import('@/workers/study-group/contract');

describe('policy versions (Q18)', () => {
  it('asks again only for material changes; a minor edit takes effect without blocking anyone', async () => {
    const h = await createHarness();
    const cookie = await signIn(h, { sub: 'fake-owner' });
    // Accepted on sign-up as the new minor version.
    expect(await h.db.prepare("SELECT version FROM consents WHERE document = 'privacy'").first()).toEqual({ version: '2026-12-01' });

    // Someone who accepted the last material version isn't asked again for the minor one.
    await h.db.prepare("UPDATE consents SET version = ? WHERE document = 'privacy'").bind(MATERIAL_POLICY_VERSIONS.privacy).run();
    await expectJson(await h.handler(request('GET', '/me', { cookie })), 200, { user: expect.objectContaining({ needsConsent: false, pendingConsents: [] }) });

    // An acceptance older than the last material version is asked again.
    await h.db.prepare("UPDATE consents SET version = '2026-01-01' WHERE document = 'privacy'").run();
    await expectJson(await h.handler(request('GET', '/me', { cookie })), 200, { user: expect.objectContaining({ needsConsent: true, pendingConsents: ['privacy'] }) });
  });
});
