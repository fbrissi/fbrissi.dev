import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMessages, getProfile, messages, profiles } from '@/lib/site';

describe('site data', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('selects messages and profiles for both supported locales', () => {
    expect(getMessages('en')).toBe(messages.en);
    expect(getMessages('pt-BR')).toBe(messages['pt-BR']);
    expect(getProfile('en')).toBe(profiles.en);
    expect(getProfile('pt-BR')).toBe(profiles['pt-BR']);
  });

  it('falls back to English data for an unsupported runtime locale', () => {
    expect(getMessages('fr' as never)).toBe(messages.en);
    expect(getProfile('fr' as never)).toBe(profiles.en);
  });

  it('uses the configured public site URL when the module is loaded', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.example.com');
    vi.resetModules();

    const { siteUrl } = await import('@/lib/site');

    expect(siteUrl).toBe('https://preview.example.com');
  });

  it('uses the production site URL when no public URL is configured', async () => {
    vi.unstubAllEnvs();
    vi.resetModules();

    const { siteUrl } = await import('@/lib/site');

    expect(siteUrl).toBe('https://fbrissi.dev');
  });
});
