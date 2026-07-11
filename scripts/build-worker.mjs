#!/usr/bin/env node

/**
 * Build script for Cloudflare Worker (contact-form.ts)
 * Compiles TypeScript to JavaScript for Terraform deployment
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Paths
const workerTsPath = resolve(rootDir, 'workers/contact-form.ts');
const workerJsPath = resolve(rootDir, 'dist/contact-form.js');

console.log('📦 Building Cloudflare Worker...');

try {
  // Read TypeScript source
  let tsCode = readFileSync(workerTsPath, 'utf-8');

  // Simple TypeScript to JavaScript transformation
  // Remove type annotations and export interface
  let jsCode = tsCode
    // Remove export interface block
    .replace(/export interface Env \{[\s\S]*?\}/g, '')
    // Remove type annotations from function parameters
    .replace(/:\s*string/g, '')
    .replace(/:\s*Env/g, '')
    .replace(/:\s*Request/g, '')
    .replace(/:\s*Response/g, '')
    .replace(/:\s*Promise<[^>]+>/g, '')
    .replace(/:\s*TurnstileResponse/g, '')
    .replace(/:\s*Record<string,\s*string>/g, '')
    .replace(/:\s*void/g, '')
    // Remove interface definitions
    .replace(/interface TurnstileResponse \{[\s\S]*?\}/g, '')
    .replace(/interface ContactFormData \{[\s\S]*?\}/g, '')
    // Clean up extra whitespace
    .replace(/\n\n\n+/g, '\n\n')
    .trim();

  // Ensure dist directory exists
  mkdirSync(dirname(workerJsPath), { recursive: true });

  // Write JavaScript output
  writeFileSync(workerJsPath, jsCode, 'utf-8');

  console.log('✅ Worker built successfully!');
  console.log(`   Input:  ${workerTsPath}`);
  console.log(`   Output: ${workerJsPath}`);
  console.log('   Ready for Terraform deployment');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
