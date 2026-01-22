/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';

const STATE_FOLDER = '.sfdx';
const TOOLS = 'tools';
const TEST_RESULTS = 'testresults';

/** Gets the test results folder path and creates it if it doesn't exist */
export const getTestResultsFolder = async (vscodePath: string, testType: string): Promise<string> => {
  const pathToTestResultsFolder = path.join(vscodePath, STATE_FOLDER, TOOLS, TEST_RESULTS, testType);

  await Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const fsService = yield* api.services.FsService;
      yield* fsService.createDirectory(pathToTestResultsFolder);
    }).pipe(
      Effect.tapError(error => Effect.logError(error)),
      Effect.catchAll(() => Effect.void), // Ignore errors - directory may already exist
      Effect.provide(AllServicesLayer)
    )
  );

  return pathToTestResultsFolder;
};
