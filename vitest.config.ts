import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
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
      exclude: ['**/*.d.ts', 'src/main.tsx', 'workers/contact-message.ts'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
