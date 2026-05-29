/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import type { MetadataChangeEventType } from 'salesforcedx-vscode-services';
import { IS_TEST_REG_EXP } from '../constants';
import { getTestController } from '../views/testController';

const APEX_METADATA_TYPES = new Set(['ApexClass', 'ApexTestSuite']);
const APEX_CHANGE_TYPES = new Set<string>(['created', 'changed', 'deleted']);

const filterApexTests = Effect.fn('isApexTestFileOrNotPresentLocally', {
  root: true,
  attributes: { telemetryIgnore: true }
})(function* (e: MetadataChangeEventType) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  if (e.metadataType === 'ApexTestSuite' || e.changeType === 'deleted') return true;
  const fileUri = Option.getOrUndefined(e.fileUri);
  if (!fileUri) return true;
  return IS_TEST_REG_EXP.test(yield* fsService.readFile(fileUri));
});

/** Incrementally update test tree when ApexClass or ApexTestSuite components are deployed */
export const setupApexMetadataChangeWatcher = Effect.fn('apex-testing.watchApexMetadataChanges')(function* (
  testController: ReturnType<typeof getTestController>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationService = yield* api.services.MetadataChangeNotificationService;

  // Accumulate fullName → changeType for all qualifying events (no file I/O)
  const pendingChanges = yield* Ref.make<Map<string, string>>(new Map());
  // Once any file confirms @isTest, skip reads for remaining events in burst
  const hasConfirmedTest = yield* Ref.make(false);
  // Track whether any suite changed
  const pendingHasSuite = yield* Ref.make(false);

  yield* Stream.fromPubSub(notificationService.pubsub).pipe(
    Stream.filter(e => APEX_METADATA_TYPES.has(e.metadataType)),
    Stream.filter(e => APEX_CHANGE_TYPES.has(e.changeType)),
    // Always accumulate name + changeType (cheap, no I/O)
    Stream.tap(e =>
      Effect.all([
        Ref.update(pendingChanges, m => new Map(m).set(e.fullName, e.changeType)),
        e.metadataType === 'ApexTestSuite' ? Ref.set(pendingHasSuite, true) : Effect.void
      ])
    ),
    // Gate file reads: once confirmed, pass through without reading
    Stream.filterEffect(e =>
      Effect.gen(function* () {
        if (yield* Ref.get(hasConfirmedTest)) return true;
        const isTest = yield* filterApexTests(e);
        if (isTest) yield* Ref.set(hasConfirmedTest, true);
        return isTest;
      })
    ),
    Stream.debounce(Duration.millis(1000)),
    Stream.runForEach(() =>
      Effect.gen(function* () {
        const changes = yield* Ref.getAndSet(pendingChanges, new Map<string, string>());
        const hasSuite = yield* Ref.getAndSet(pendingHasSuite, false);
        yield* Ref.set(hasConfirmedTest, false);
        yield* Effect.promise(() => testController.incrementalUpdate(changes, hasSuite));
      })
    )
  );
});
