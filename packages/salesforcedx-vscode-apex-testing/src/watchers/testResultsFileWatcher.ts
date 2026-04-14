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

/** Normalize path separators to forward slashes for cross-platform comparison */
const normalizePath = (p: string): string => p.replaceAll('\\', '/');

/** Check if a file event is a test result JSON file */
const isTestResultJsonFile = (event: FileChangeEvent): boolean => {
  const uriPath = normalizePath(event.uri.path || event.uri.fsPath);
  return (
    (event.type === 'create' || event.type === 'change') &&
    uriPath.includes('.sfdx/tools/testresults/apex') &&
    uriPath.endsWith('.json')
  );
};

/** Set up file watcher for test result JSON files using FileWatcherService */
export const setupTestResultsFileWatcher = Effect.fn('apex-testing.watchTestResults')(function* (
  testController: ReturnType<typeof getTestController>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fileChangePubSub = yield* api.services.FileChangePubSub;

  yield* Stream.fromPubSub(fileChangePubSub).pipe(
    Stream.filter(isTestResultJsonFile),
    Stream.runForEach(event => {
      const apexDirUri = Utils.dirname(event.uri);
      void testController.onResultFileCreate(apexDirUri, event.uri);
      return Effect.void;
    })
  );
});
