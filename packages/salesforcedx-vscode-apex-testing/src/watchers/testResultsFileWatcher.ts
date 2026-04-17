/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import type { FileChangeEvent } from 'salesforcedx-vscode-services';
import { Utils } from 'vscode-uri';
import { getTestController } from '../views/testController';

/** Check if a file event is a test result JSON file */
const isTestResultJsonFile = (event: FileChangeEvent): boolean =>
  // uri.path is already normalized
  event.uri.path.includes('.sfdx/tools/testresults/apex') && event.uri.path.endsWith('.json');

/** Set up file watcher for test result JSON files using FileWatcherService */
export const setupTestResultsFileWatcher = Effect.fn('apex-testing.watchTestResults')(function* (
  testController: ReturnType<typeof getTestController>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fileChangePubSub = yield* api.services.FileChangePubSub;

  yield* Stream.fromPubSub(fileChangePubSub).pipe(
    Stream.filter(e => e.type !== 'delete'),
    Stream.filter(isTestResultJsonFile),
    Stream.runForEach(event => {
      const apexDirUri = Utils.dirname(event.uri);
      void testController.onResultFileCreate(apexDirUri, event.uri);
      return Effect.void;
    })
  );
});
