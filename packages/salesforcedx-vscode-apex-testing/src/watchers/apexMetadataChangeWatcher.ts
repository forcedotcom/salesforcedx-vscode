/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { getTestController } from '../views/testController';

const APEX_METADATA_TYPES = new Set(['ApexClass', 'ApexTestSuite']);
const APEX_CHANGE_TYPES = new Set<string>(['created', 'changed', 'deleted']);

/** Re-discover tests when ApexClass or ApexTestSuite components are deployed */
export const setupApexMetadataChangeWatcher = Effect.fn('apex-testing.watchApexMetadataChanges')(function* (
  testController: ReturnType<typeof getTestController>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationService = yield* api.services.MetadataChangeNotificationService;

  yield* Stream.fromPubSub(notificationService.pubsub).pipe(
    Stream.filter(e => APEX_METADATA_TYPES.has(e.metadataType)),
    Stream.filter(e => APEX_CHANGE_TYPES.has(e.changeType)),
    Stream.debounce(Duration.millis(1000)),
    Stream.runForEach(() => Effect.promise(() => testController.discoverTests()))
  );
});
