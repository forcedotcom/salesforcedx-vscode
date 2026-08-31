/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_PACKAGE = '@salesforce/cli';
const CLI_CHANNEL = 'latest-rc';
const CLI_SPEC = `${CLI_PACKAGE}@${CLI_CHANNEL}`;
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(PACKAGE_ROOT, 'src/observability/generated/sfCommandCatalog.ts');

const runSfJson = args => {
  const result = spawnSync(NPX, ['--yes', `--package=${CLI_SPEC}`, 'sf', ...args, '--json'], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Failed to run sf ${args.join(' ')}:\n${result.stderr || result.stdout}`);
  }

  return JSON.parse(result.stdout);
};

const versionJson = runSfJson(['version']);
const versionPrefix = `${CLI_PACKAGE}/`;
if (typeof versionJson.cliVersion !== 'string' || !versionJson.cliVersion.startsWith(versionPrefix)) {
  throw new TypeError(`Unexpected sf version response: ${JSON.stringify(versionJson)}`);
}
const resolvedVersion = versionJson.cliVersion.slice(versionPrefix.length);

const commands = runSfJson(['commands']);
if (!Array.isArray(commands)) throw new TypeError('Expected sf commands --json to return an array');

const spellings = new Set();
for (const command of commands) {
  if (!command || typeof command !== 'object' || typeof command.id !== 'string') {
    throw new TypeError(`Unexpected command entry: ${JSON.stringify(command)}`);
  }

  for (const candidate of [
    command.id,
    ...(command.aliases ?? []),
    ...(command.hiddenAliases ?? []),
    ...(command.permutations ?? []),
    ...(command.aliasPermutations ?? [])
  ]) {
    if (typeof candidate !== 'string') throw new TypeError(`Unexpected command spelling: ${JSON.stringify(candidate)}`);
    const normalized = candidate.replaceAll(':', ' ').trim().replaceAll(/\s+/g, ' ');
    if (normalized) spellings.add(normalized);
  }
}

const commandTokenSequences = [...spellings].sort();
const maxCommandTokens = Math.max(...commandTokenSequences.map(command => command.split(' ').length));
const tsString = value =>
  `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')}'`;
const source = `/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// AUTO-GENERATED for services telemetry by scripts/generate-sf-command-catalog.mjs. Do not edit by hand.
export const SF_COMMAND_CATALOG_PROVENANCE = {
  package: ${tsString(CLI_PACKAGE)},
  requestedChannel: ${tsString(CLI_CHANNEL)},
  resolvedVersion: ${tsString(resolvedVersion)},
  commandCount: ${commands.length},
  spellingCount: ${commandTokenSequences.length},
  maxCommandTokens: ${maxCommandTokens}
} as const;

export const SF_COMMAND_TOKEN_SEQUENCES: readonly string[] = [
${commandTokenSequences.map(command => `  ${tsString(command)}`).join(',\n')}
];
`;

writeFileSync(OUTPUT, source);
console.log(
  `Generated ${commandTokenSequences.length} command spellings from ${CLI_PACKAGE}@${resolvedVersion} at ${OUTPUT}`
);
