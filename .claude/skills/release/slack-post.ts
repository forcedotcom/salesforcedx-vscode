#!/usr/bin/env ts-node
import { readFileSync } from 'fs';
import { join } from 'path';

const CHANGELOG_PATH = join(process.cwd(), 'packages/salesforcedx-vscode/CHANGELOG.md');
const REPO = 'forcedotcom/salesforcedx-vscode';
const MARKETPLACE_URL = 'https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode';

const versionArg = (() => {
  const idx = process.argv.indexOf('--version');
  return idx !== -1 ? process.argv[idx + 1] : undefined;
})();

const changelog = readFileSync(CHANGELOG_PATH, 'utf8');
const sections = changelog.split(/^(?=# \d+\.\d+\.\d+)/m);

const targetSection = versionArg
  ? sections.find(s => s.startsWith(`# ${versionArg}`))
  : sections.find(s => /^# \d+\.\d+\.\d+/.test(s));

if (!targetSection) {
  process.stderr.write(`Version ${versionArg ?? '(latest)'} not found in changelog\n`);
  process.exit(1);
}

const versionMatch = targetSection.match(/^# (\d+\.\d+\.\d+)/);
const version = versionMatch![1];

// Strip PR/issue links: ([PR #N](url)), ([ISSUE #N](url)), including comma-separated lists
// e.g. " ([PR #7162](...), [ISSUE #7108](...))" → ""
const stripLinks = (line: string): string =>
  line
    .replace(/\s*\(\s*(?:\[(?:PR|ISSUE) #\d+\]\([^)]*\)(?:,\s*)?)+\s*\)/g, '')
    .trimEnd();

const lines = targetSection.split('\n').slice(1); // drop the "# X.Y.Z - Date" header line

const slackLines: string[] = [
  `*Salesforce Extensions for VS Code v${version} is out* :tada:`,
  `<${MARKETPLACE_URL}|VS Code Marketplace> — see the *Changelog* tab for full details`,
  ''
];

for (const raw of lines) {
  if (/^## Added/.test(raw)) {
    slackLines.push('*Added*');
  } else if (/^## Fixed/.test(raw)) {
    slackLines.push('*Fixed*');
  } else if (/^#### /.test(raw)) {
    slackLines.push(`> ${raw}`);
  } else if (/^- /.test(raw)) {
    const stripped = stripLinks(raw);
    if (stripped.trim()) slackLines.push(stripped);
  } else if (raw.trim() === '') {
    slackLines.push('');
  }
}

// Trim trailing blank lines
while (slackLines.length && slackLines[slackLines.length - 1] === '') slackLines.pop();

process.stdout.write(slackLines.join('\n') + '\n');
