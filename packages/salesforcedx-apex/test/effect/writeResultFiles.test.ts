/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { FileOutput } from '../../src/effect/fileOutput';
import { writeResultFiles } from '../../src/effect/writeResultFiles';
import { successResult } from '../reporters/testResults';

const createMemoryFileOutput = (files: Map<string, string>): typeof FileOutput.Service => ({
  createDirectory: () => Effect.void,
  writeFile: (directory, fileName, content) =>
    Stream.runCollect(content).pipe(
      Effect.map(Chunk.join('')),
      Effect.map(content => {
        const path = `${directory}/${fileName}`;
        files.set(path, content);
        return path;
      })
    )
});

describe('Effect writeResultFiles', () => {
  it('writes compact JSON and coverage files through the provided file output', async () => {
    const files = new Map<string, string>();
    const fileOutput = createMemoryFileOutput(files);
    const result = {
      ...successResult,
      summary: { ...successResult.summary, testRunId: undefined },
      tests: [],
      codecoverage: undefined
    };

    const written = await Effect.runPromise(
      writeResultFiles(result, { dirPath: '/reports', resultFormats: ['json'] }, { codeCoverage: true }).pipe(
        Effect.provideService(FileOutput, fileOutput)
      )
    );

    expect(written).toEqual(['/reports/test-result-default.json', '/reports/test-result-default-codecoverage.json']);
    expect(files.get('/reports/test-result-default.json')).toBe(
      JSON.stringify({ summary: result.summary, tests: result.tests })
    );
    expect(files.get('/reports/test-result-default-codecoverage.json')).toBe('[]');
  });

  it('can include setup rows when the caller writes extension JSON', async () => {
    const files = new Map<string, string>();
    const result = {
      ...successResult,
      tests: [],
      setup: [
        {
          methodName: 'testSetup',
          apexClass: { name: 'SetupClass', fullName: 'SetupClass' },
          testSetupTime: 1,
          fullName: 'SetupClass.testSetup'
        }
      ],
      codecoverage: undefined
    };

    await Effect.runPromise(
      writeResultFiles(result, { dirPath: '/reports', resultFormats: ['json'] }, { includeSetup: true }).pipe(
        Effect.provideService(FileOutput, createMemoryFileOutput(files))
      )
    );

    expect(files.get('/reports/test-result-7073t000061uwZI.json')).toBe(
      JSON.stringify({ summary: result.summary, tests: [], setup: result.setup })
    );
  });
});
