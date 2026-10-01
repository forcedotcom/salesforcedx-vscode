/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(packageRoot, 'test/baselines/soql-ui-bundles.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const formatBytes = value => `${new Intl.NumberFormat('en-US').format(value)} B`;
const failures = [];

console.log('SOQL UI bundle baseline (gzip level 9)');

for (const artifact of config.artifacts) {
  const missingFiles = artifact.files.filter(file => !existsSync(resolve(packageRoot, file)));
  if (missingFiles.length > 0) {
    failures.push(`${artifact.name}: missing ${missingFiles.join(', ')}`);
    continue;
  }

  const content = Buffer.concat(artifact.files.map(file => readFileSync(resolve(packageRoot, file))));
  const actual = {
    rawBytes: content.byteLength,
    gzipBytes: gzipSync(content, { level: 9 }).byteLength
  };

  console.log(`\n${artifact.name}`);
  for (const metric of ['rawBytes', 'gzipBytes']) {
    const delta = actual[metric] - artifact.baseline[metric];
    const deltaLabel = `${delta >= 0 ? '+' : ''}${formatBytes(delta)}`;
    console.log(
      `  ${metric === 'rawBytes' ? 'raw ' : 'gzip'} ${formatBytes(actual[metric])} ` +
        `(baseline ${formatBytes(artifact.baseline[metric])}, ${deltaLabel}; budget ${formatBytes(artifact.budget[metric])})`
    );
    if (actual[metric] > artifact.budget[metric]) {
      failures.push(
        `${artifact.name} ${metric}: ${formatBytes(actual[metric])} exceeds ${formatBytes(artifact.budget[metric])}`
      );
    }
  }
}

if (failures.length > 0) {
  console.error('\nSOQL UI bundle gate failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('\nSOQL UI bundle gate passed.');
}
