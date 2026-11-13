// Prints a `pbkdf2-sha256$<iterations>$<saltB64>$<hashB64>` hash for STUDY_GROUP_ADMIN_PASSWORD_HASH.
// The password is read from stdin so it never lands in shell history or the process list:
//   node scripts/hash-study-group-password.mjs [--iterations=10000] < password.txt
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const MAX_ITERATIONS = 100_000;
const iterationsArg = process.argv.slice(2).find((arg) => arg.startsWith('--iterations='));
const iterations = iterationsArg ? Number(iterationsArg.slice('--iterations='.length)) : 10_000;

if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
  console.error(`--iterations must be an integer between 1 and ${MAX_ITERATIONS}.`);
  process.exit(1);
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');

if (!password) {
  console.error('Provide the password on stdin.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
console.log(`pbkdf2-sha256$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`);
