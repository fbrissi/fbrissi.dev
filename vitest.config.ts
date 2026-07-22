import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: 'cloudflare:email', replacement: path.join(rootDir, 'test/mocks/cloudflare-email.ts') },
      { find: '@/workers', replacement: path.join(rootDir, 'workers') },
      { find: '@', replacement: path.join(rootDir, 'src') },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'cobertura'],
      include: ['src/**/*.{ts,tsx}', 'workers/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        'src/app/**',
        'src/generated/**',
        'src/lib/next-metadata.ts',
        'src/site-pages/not-found-page.tsx',
        'workers/contact-message.ts'
      ],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
