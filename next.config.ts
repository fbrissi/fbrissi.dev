import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const baseConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true }
};

/**
 * `next dev` mirrors what Cloudflare serves in production: the group page rewrite and the old board redirect from
 * `public/_redirects`, and the same-origin study group API (a Worker route in production) proxied to the local API.
 */
function developmentConfig(): NextConfig {
  const apiProxyUrl = process.env.STUDY_GROUP_API_PROXY_URL ?? 'http://localhost:8788';
  const slug = process.env.STUDY_GROUP_SLUG?.trim();

  return {
    ...baseConfig,
    async rewrites() {
      return [
        { source: '/study-groups/g/:id/settings', destination: '/study-groups/group/settings' },
        { source: '/study-groups/g/:id', destination: '/study-groups/group' },
        { source: '/api/study-group/:path*', destination: `${apiProxyUrl}/api/study-group/:path*` }
      ];
    },
    async redirects() {
      return slug
        ? [
            { source: `/study-group/${slug}/settings`, destination: '/study-groups/g/devtalk/settings', permanent: true },
            { source: `/study-group/${slug}`, destination: '/study-groups/g/devtalk', permanent: true }
          ]
        : [];
    }
  };
}

export default function config(phase: string): NextConfig {
  return phase === PHASE_DEVELOPMENT_SERVER ? developmentConfig() : baseConfig;
}
