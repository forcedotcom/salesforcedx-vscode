/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Stream from 'effect/Stream';
import type { MetadataChangeEventType } from 'salesforcedx-vscode-services';
import { IS_TEST_REG_EXP } from '../constants';
import { getTestController } from '../views/testController';

const APEX_METADATA_TYPES = new Set(['ApexClass', 'ApexTestSuite']);
const APEX_CHANGE_TYPES = new Set<string>(['created', 'changed', 'deleted']);

const filterApexTests = Effect.fn('isApexTestFileOrNotPresentLocally')(function* (e: MetadataChangeEventType) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  // we can't read files we don't have anymore
  if (e.metadataType === 'ApexTestSuite' || e.changeType === 'deleted') return true;
  const fileUri = Option.getOrUndefined(e.fileUri);
  if (!fileUri) return true; // we don't have the file to look at anymore
  return IS_TEST_REG_EXP.test(yield* fsService.readFile(fileUri));
});

/** Re-discover tests when ApexClass or ApexTestSuite components are deployed */
export const setupApexMetadataChangeWatcher = Effect.fn('apex-testing.watchApexMetadataChanges')(function* (
  testController: ReturnType<typeof getTestController>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationService = yield* api.services.MetadataChangeNotificationService;

  yield* Stream.fromPubSub(notificationService.pubsub).pipe(
    Stream.filter(e => APEX_METADATA_TYPES.has(e.metadataType)),
    Stream.filter(e => APEX_CHANGE_TYPES.has(e.changeType)),
    // let's filter out any local files that changed but are not apex tests
    Stream.filterEffect(filterApexTests),
    Stream.debounce(Duration.millis(1000)),
    Stream.runForEach(() => Effect.promise(() => testController.discoverTests()))
  );
});
