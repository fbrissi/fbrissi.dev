import { afterEach, describe, expect, it, vi } from 'vitest';

describe('seo', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('resolves absolute URLs against the configured site URL', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://preview.example.com/base/');
    const { absoluteUrl } = await import('@/lib/seo');

    expect(absoluteUrl('/articles/example')).toBe('https://preview.example.com/articles/example');
  });

  it('creates English metadata with the default social image', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://example.com');
    const { createPageMetadata } = await import('@/lib/seo');

    expect(
      createPageMetadata({
        locale: 'en',
        pathname: 'articles/example',
        title: 'Example title',
        description: 'Example description'
      })
    ).toMatchObject({
      title: 'Example title',
      description: 'Example description',
      alternates: {
        canonical: 'https://example.com/articles/example',
        languages: {
          en: 'https://example.com/articles/example',
          'pt-BR': 'https://example.com/pt-br/articles/example'
        }
      },
      openGraph: {
        url: 'https://example.com/articles/example',
        locale: 'en_US',
        alternateLocale: 'pt_BR',
        images: [{ url: 'https://example.com/images/og/og-image-avatar.png', width: 1200, height: 630, alt: 'Example title' }]
      },
      twitter: { images: ['https://example.com/images/og/og-image-avatar.png'] }
    });
  });

  it('creates Portuguese metadata with a supplied social image', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://example.com');
    const { createPageMetadata } = await import('@/lib/seo');

    expect(
      createPageMetadata({
        locale: 'pt-BR',
        pathname: '/',
        title: 'Título',
        description: 'Descrição',
        image: '/custom.svg'
      })
    ).toMatchObject({
      alternates: {
        canonical: 'https://example.com/pt-br',
        languages: { en: 'https://example.com/', 'pt-BR': 'https://example.com/pt-br' }
      },
      openGraph: {
        locale: 'pt_BR',
        alternateLocale: 'en_US',
        images: [{ url: 'https://example.com/custom.svg' }]
      },
      twitter: { images: ['https://example.com/custom.svg'] }
    });
  });
});
