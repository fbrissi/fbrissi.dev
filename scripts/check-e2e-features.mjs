#!/usr/bin/env node
// Keeps the Gherkin files in e2e/features/ the source of truth for the E2E suite: every scenario (every Examples row of
// a Scenario Outline) must have a Playwright test with exactly its title, and every Playwright test must belong to a
// scenario. Test titles come from `playwright test --list`, so it needs the project's dependencies but no browser.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const featuresDir = path.join(root, 'e2e', 'features');

/** The scenario titles of one feature file, with each Scenario Outline expanded by its Examples rows. */
export function scenarioTitles(source, file = 'feature') {
  const titles = [];
  let outline = null;
  let header = null;
  const finishOutline = () => {
    if (outline && !outline.rows) throw new Error(`${file}: Scenario Outline "${outline.title}" has no Examples`);
    outline = null;
  };
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('@')) return;
    const keyword = line.match(/^(Feature|Background|Scenario Outline|Scenario Template|Scenario|Example|Examples|Scenarios|Rule):\s*(.*)$/);
    if (keyword) {
      const [, kind, text] = keyword;
      if (kind === 'Scenario Outline' || kind === 'Scenario Template') {
        finishOutline();
        outline = { title: text, rows: 0 };
      } else if (kind === 'Scenario' || kind === 'Example') {
        finishOutline();
        titles.push({ title: text, file, line: index + 1 });
      } else if (kind === 'Examples' || kind === 'Scenarios') {
        if (!outline) throw new Error(`${file}:${index + 1}: Examples outside a Scenario Outline`);
        header = null;
        outline.examplesLine = index + 1;
      } else {
        finishOutline();
      }
      return;
    }
    if (line.startsWith('|') && outline && outline.examplesLine) {
      const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
      if (!header) {
        header = cells;
        return;
      }
      outline.rows += 1;
      const title = outline.title.replace(/<([^>]+)>/g, (match, name) => {
        const column = header.indexOf(name);
        if (column < 0) throw new Error(`${file}:${index + 1}: no Examples column <${name}>`);
        return cells[column];
      });
      titles.push({ title, file, line: index + 1 });
    }
  });
  finishOutline();
  return titles;
}

function listedTests() {
  const output = execFileSync(path.join(root, 'node_modules', '.bin', 'playwright'), ['test', '--list'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return output
    .split('\n')
    .filter((line) => /\.e2e\.ts:\d+:\d+ › /.test(line))
    .map((line) => {
      const parts = line.trim().split(' › ');
      return { title: parts.at(-1), where: parts[1] };
    });
}

const files = readdirSync(featuresDir).filter((name) => name.endsWith('.feature')).sort();
const scenarios = files.flatMap((name) => scenarioTitles(readFileSync(path.join(featuresDir, name), 'utf8'), `e2e/features/${name}`));
const tests = listedTests();
const testTitles = new Set(tests.map((test) => test.title));
const scenarioSet = new Set(scenarios.map((scenario) => scenario.title));

const missing = scenarios.filter((scenario) => !testTitles.has(scenario.title));
const orphans = tests.filter((test) => !scenarioSet.has(test.title));
const duplicates = scenarios.filter((scenario, index) => scenarios.findIndex((other) => other.title === scenario.title) !== index);

console.log(`${files.length} feature files, ${scenarios.length} scenarios, ${tests.length} Playwright tests.`);
for (const scenario of missing) console.error(`No test for scenario: "${scenario.title}" (${scenario.file}:${scenario.line})`);
for (const test of orphans) console.error(`No scenario for test: "${test.title}" (${test.where})`);
for (const scenario of duplicates) console.error(`Duplicate scenario title: "${scenario.title}" (${scenario.file}:${scenario.line})`);
if (missing.length || orphans.length || duplicates.length) process.exit(1);
