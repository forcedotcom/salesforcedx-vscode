/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Effect from 'effect/Effect';
import { NodeFileOutputLayer } from '../../../src/effect/nodeFileOutput';
import { writeResultFiles } from '../../../src/effect/writeResultFiles';
import { parityFileInfos, parityFormats, parityResults, parityScenarios } from './fixtures';

// Snapshot of writeResultFiles output as written by @salesforce/apex-node@9.1.13, byte for byte.
// Known intentional differences from 9.1.13 (current behavior is what's snapshotted):
// - JUnit escapes the testsuite hostname attribute (9.1.13 wrote it raw, producing invalid XML).
// - TAP splits stack traces on any newline form (9.1.13 split on os.EOL only, leaving \r\n on POSIX).
// The "large" scenario stores size + sha256 to keep the snapshot small.

const normalizeTimestamps = (content: string): string =>
  content
    .replaceAll(/(Run completed:\*{0,2} ).+/g, '$1[TIMESTAMP]')
    .replaceAll(/(<property name="testStartTime" value=")[^"]+("\/>)/g, '$1[TIMESTAMP]$2');

describe('writeResultFiles - upstream apex-node 9.1.13 parity', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `apex-upstream-parity-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it.each(parityScenarios)('$name', async ({ name, result, codeCoverage }) => {
    const dirPath = join(tempDir, name);
    await Effect.runPromise(
      writeResultFiles(
        parityResults[result],
        {
          dirPath,
          resultFormats: parityFormats,
          fileInfos: parityFileInfos
        },
        { codeCoverage }
      ).pipe(Effect.provide(NodeFileOutputLayer))
    );

    const files = (await readdir(dirPath)).sort();
    expect(files).toMatchSnapshot('file names');

    for (const file of files) {
      const content = await readFile(join(dirPath, file), 'utf8');
      if (result === 'large' && file.startsWith('test-result-')) {
        expect({
          bytes: Buffer.byteLength(normalizeTimestamps(content)),
          sha256: createHash('sha256').update(normalizeTimestamps(content)).digest('hex')
        }).toMatchSnapshot(file);
      } else {
        expect(normalizeTimestamps(content)).toMatchSnapshot(file);
      }
    }
  });

  it('writes only test-run-id.txt for a run id result', async () => {
    const dirPath = join(tempDir, 'runid-only');
    await Effect.runPromise(
      writeResultFiles({ testRunId: '707000000000002AAA' }, { dirPath }).pipe(Effect.provide(NodeFileOutputLayer))
    );
    const files = await readdir(dirPath);
    expect(files).toEqual(['test-run-id.txt']);
    expect(await readFile(join(dirPath, 'test-run-id.txt'), 'utf8')).toBe('707000000000002AAA');
  });
});
