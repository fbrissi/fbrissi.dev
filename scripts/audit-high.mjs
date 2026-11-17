#!/usr/bin/env node
// Fails on high or critical advisories, except unexpired entries in audit-allowlist.json.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const manager = process.argv[2];
const commands = {
  npm: ['npm', ['audit', '--json', '--no-package-lock']],
  yarn: ['yarn', ['audit', '--json']],
};
if (!commands[manager]) {
  console.error('Usage: audit-high.mjs <npm|yarn>');
  process.exit(2);
}

const today = new Date().toISOString().slice(0, 10);
const allowed = new Map();
for (const entry of JSON.parse(readFileSync(new URL('../audit-allowlist.json', import.meta.url), 'utf8'))) {
  if (entry.until < today) {
    console.log(`::warning::Allowlist entry ${entry.id} expired on ${entry.until} and is ignored.`);
  } else {
    allowed.set(entry.id, entry);
  }
}

const [command, args] = commands[manager];
const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (result.error) throw result.error;

const advisories = new Map();
const add = (id, severity, name) => {
  if (id && ['high', 'critical'].includes(severity)) advisories.set(id, { severity, name });
};
try {
  if (manager === 'yarn') {
    for (const line of result.stdout.split('\n').filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.type === 'auditAdvisory') {
        const { github_advisory_id: id, severity, module_name: name } = event.data.advisory;
        add(id, severity, name);
      }
    }
  } else {
    for (const vulnerability of Object.values(JSON.parse(result.stdout).vulnerabilities ?? {})) {
      for (const via of vulnerability.via.filter((item) => typeof item === 'object')) {
        add(via.url?.split('/').pop(), via.severity, via.name);
      }
    }
  }
} catch (error) {
  console.error(`Could not parse the ${manager} audit output: ${error.message}`);
  console.error(result.stderr);
  process.exit(1);
}

let blocked = 0;
for (const [id, { severity, name }] of advisories) {
  const entry = allowed.get(id);
  if (entry) {
    console.log(`::warning::Allowed until ${entry.until}: ${severity} ${id} in ${name}. ${entry.reason}`);
  } else {
    console.log(`::error::${severity} ${id} in ${name}: https://github.com/advisories/${id}`);
    blocked += 1;
  }
}
console.log(`${advisories.size} high or critical advisories, ${blocked} not allowlisted.`);
process.exit(blocked > 0 ? 1 : 0);
