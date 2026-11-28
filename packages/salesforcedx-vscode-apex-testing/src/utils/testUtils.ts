/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type TestResult } from '@salesforce/apex-node';
import { FileOutput, writeResultFiles } from '@salesforce/apex-node/effect';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { type URI, Utils } from 'vscode-uri';
import { fileOutputFromFsService } from '../services/fsServiceFileOutput';

/** Reads test-run-id.txt using FsService (works in both desktop and web) */
export const readTestRunIdFile = Effect.fn('testUtils.readTestRunIdFile')(
  function* (apexTestDir: URI) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const fileUri = Utils.joinPath(apexTestDir, 'test-run-id.txt');
    const content = yield* api.v2.services.FsService.use(service => service.readFile(fileUri));
    return content.trim();
  },
  Effect.orElseSucceed(() => undefined)
);

/** Writes result JSON, run ID, and optional coverage through apex-node's shared writer. */
export const writeTestResultJsonFile = Effect.fn('testUtils.writeTestResultJsonFile')(function* (
  result: TestResult,
  outputDir: URI,
  codeCoverage: boolean
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.v2.services.FsService;
  yield* writeResultFiles(
    result,
    { dirPath: outputDir.toString(), resultFormats: ['json'] },
    { codeCoverage, includeSetup: true }
  ).pipe(Effect.provideService(FileOutput, fileOutputFromFsService(fsService)));
});
