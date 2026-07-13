#!/usr/bin/env node

/**
 * Build Cloudflare Worker modules for Terraform deployment.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const workers = [
  ['contact-api', 'workers/contact-api.ts'],
  ['contact-email-consumer', 'workers/contact-email-consumer.ts'],
];

console.log('Building Cloudflare Workers...');

try {
  mkdirSync(resolve(rootDir, 'dist'), { recursive: true });
  await Promise.all(workers.map(([name, entryPoint]) => build({
    entryPoints: [resolve(rootDir, entryPoint)],
    outfile: resolve(rootDir, 'dist', `${name}.js`),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
  })));

  console.log('Workers built successfully. Ready for Terraform deployment.');
} catch (error) {
  console.error('Worker build failed:', error.message);
  process.exit(1);
}
