/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Scope from 'effect/Scope';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import {
  MetadataChangeNotificationService,
  type MetadataChangeEvent as MetadataChangeEventType
} from 'salesforcedx-vscode-services/src/core/metadataChangeNotificationService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { URI } from 'vscode-uri';
import { setupApexMetadataChangeWatcher } from '../../../src/watchers/apexMetadataChangeWatcher';

const APEX_TEST_CONTENT = '@isTest\npublic class MyTest {}';
const NON_TEST_CONTENT = 'public class MyClass {}';

const DEBOUNCE_PLUS_MARGIN = '1100 millis';

const makeEvent = (
  overrides: Partial<MetadataChangeEventType> & Pick<MetadataChangeEventType, 'metadataType'>
): MetadataChangeEventType => ({
  metadataType: overrides.metadataType,
  fullName: overrides.fullName ?? 'MyClass',
  changeType: overrides.changeType ?? 'changed',
  fileUri: overrides.fileUri ?? Option.some(URI.file('/tmp/MyClass.cls'))
});

/**
 * `replay: 16` lets us publish before the watcher subscribes; the subscriber receives buffered events.
 * `forkScoped` ties the watcher fiber to the test's scope so it's interrupted on test exit.
 * `TestClock.adjust` runs actions scheduled on or before the adjusted time.
 */
const setupHarness = Effect.fn('setupHarness')(function* (readFileResponses: Map<string, string> = new Map()) {
  const pubsub = yield* PubSub.unbounded<MetadataChangeEventType>({ replay: 16 });
  const incrementalUpdate = jest.fn<Promise<void>, [Map<string, string>, boolean]>(() => Promise.resolve());
  const testController = { incrementalUpdate } as unknown as Parameters<typeof setupApexMetadataChangeWatcher>[0];

  const readFileFn = jest.fn((uri: unknown) => Effect.succeed(readFileResponses.get(String(uri)) ?? NON_TEST_CONTENT));

  const notificationLayer = Layer.succeed(MetadataChangeNotificationService, { pubsub } as any);
  const fsLayer = Layer.succeed(FsService, { readFile: readFileFn } as unknown as InstanceType<typeof FsService>);
  const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        MetadataChangeNotificationService,
        FsService
      }
    })
  } as any);

  const provided = setupApexMetadataChangeWatcher(testController).pipe(
    Effect.provide(Layer.mergeAll(notificationLayer, fsLayer, extensionProviderLayer))
  );
  yield* Effect.forkScoped(provided);

  return { pubsub, incrementalUpdate, readFileFn };
});

const advance = TestClock.adjust(DEBOUNCE_PLUS_MARGIN);

const runTest = <A>(effect: Effect.Effect<A, unknown, Scope.Scope>) =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(TestContext.TestContext)));

describe('setupApexMetadataChangeWatcher', () => {
  it('calls incrementalUpdate with changes map after debounce when an apex test event arrives', () =>
    runTest(
      Effect.gen(function* () {
        const responses = new Map([[URI.file('/tmp/MyClass.cls').toString(), APEX_TEST_CONTENT]]);
        const { pubsub, incrementalUpdate } = yield* setupHarness(responses);

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexClass' }));
        expect(incrementalUpdate).not.toHaveBeenCalled();

        yield* advance;

        expect(incrementalUpdate).toHaveBeenCalledTimes(1);
        const [changes, hasSuite] = incrementalUpdate.mock.calls[0];
        expect(changes).toBeInstanceOf(Map);
        expect(changes.get('MyClass')).toBe('changed');
        expect(hasSuite).toBe(false);
      })
    ));

  it('does not call incrementalUpdate for non-apex metadata types', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, incrementalUpdate } = yield* setupHarness();

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'LightningComponentBundle' }));
        yield* advance;

        expect(incrementalUpdate).not.toHaveBeenCalled();
      })
    ));

  it('does not call incrementalUpdate for non-apex change types', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, incrementalUpdate } = yield* setupHarness();

        yield* PubSub.publish(
          pubsub,
          makeEvent({ metadataType: 'ApexClass', changeType: 'unchanged' as MetadataChangeEventType['changeType'] })
        );
        yield* advance;

        expect(incrementalUpdate).not.toHaveBeenCalled();
      })
    ));

  it('does not read files for deleted events but still triggers incrementalUpdate', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, readFileFn, incrementalUpdate } = yield* setupHarness();

        yield* PubSub.publish(
          pubsub,
          makeEvent({ metadataType: 'ApexClass', changeType: 'deleted', fullName: 'DeletedClass' })
        );
        yield* advance;

        expect(readFileFn).not.toHaveBeenCalled();
        expect(incrementalUpdate).toHaveBeenCalledTimes(1);
        const [changes] = incrementalUpdate.mock.calls[0];
        expect(changes.get('DeletedClass')).toBe('deleted');
      })
    ));

  it('does not read files for ApexTestSuite events and passes hasSuite=true', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, readFileFn, incrementalUpdate } = yield* setupHarness();

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexTestSuite', fullName: 'MySuite' }));
        yield* advance;

        expect(readFileFn).not.toHaveBeenCalled();
        expect(incrementalUpdate).toHaveBeenCalledTimes(1);
        const [changes, hasSuite] = incrementalUpdate.mock.calls[0];
        expect(changes.get('MySuite')).toBe('changed');
        expect(hasSuite).toBe(true);
      })
    ));

  it('skips file reads after first passing event in a burst but accumulates all names', () =>
    runTest(
      Effect.gen(function* () {
        const testUri = URI.file('/tmp/TestClass.cls');
        const nonTestUri = URI.file('/tmp/Helper.cls');
        const responses = new Map([[testUri.toString(), APEX_TEST_CONTENT]]);
        const { pubsub, readFileFn, incrementalUpdate } = yield* setupHarness(responses);

        yield* PubSub.publish(
          pubsub,
          makeEvent({ metadataType: 'ApexClass', fileUri: Option.some(testUri), fullName: 'TestClass' })
        );
        yield* PubSub.publish(
          pubsub,
          makeEvent({ metadataType: 'ApexClass', fileUri: Option.some(nonTestUri), fullName: 'Helper' })
        );
        yield* advance;

        expect(readFileFn).toHaveBeenCalledTimes(1);
        expect(incrementalUpdate).toHaveBeenCalledTimes(1);
        const [changes] = incrementalUpdate.mock.calls[0];
        expect(changes.get('TestClass')).toBe('changed');
        expect(changes.get('Helper')).toBe('changed');
      })
    ));

  it('resets state after update so subsequent bursts are processed', () =>
    runTest(
      Effect.gen(function* () {
        const testUri = URI.file('/tmp/TestClass.cls');
        const responses = new Map([[testUri.toString(), APEX_TEST_CONTENT]]);
        const { pubsub, incrementalUpdate } = yield* setupHarness(responses);

        yield* PubSub.publish(
          pubsub,
          makeEvent({ metadataType: 'ApexClass', fileUri: Option.some(testUri), fullName: 'TestClass' })
        );
        yield* advance;
        expect(incrementalUpdate).toHaveBeenCalledTimes(1);

        yield* PubSub.publish(
          pubsub,
          makeEvent({ metadataType: 'ApexClass', fileUri: Option.some(testUri), fullName: 'TestClass' })
        );
        yield* advance;
        expect(incrementalUpdate).toHaveBeenCalledTimes(2);
      })
    ));

  it('does not call incrementalUpdate when no events pass the apex test filter', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, incrementalUpdate } = yield* setupHarness();

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexClass' }));
        yield* advance;

        expect(incrementalUpdate).not.toHaveBeenCalled();
      })
    ));

  it('accumulates multiple class names with their respective change types', () =>
    runTest(
      Effect.gen(function* () {
        const testUri = URI.file('/tmp/TestClass.cls');
        const responses = new Map([[testUri.toString(), APEX_TEST_CONTENT]]);
        const { pubsub, incrementalUpdate } = yield* setupHarness(responses);

        yield* PubSub.publish(
          pubsub,
          makeEvent({
            metadataType: 'ApexClass',
            fileUri: Option.some(testUri),
            fullName: 'TestClass',
            changeType: 'changed'
          })
        );
        yield* PubSub.publish(
          pubsub,
          makeEvent({ metadataType: 'ApexClass', fullName: 'NewClass', changeType: 'created' })
        );
        yield* PubSub.publish(
          pubsub,
          makeEvent({ metadataType: 'ApexClass', fullName: 'OldClass', changeType: 'deleted' })
        );
        yield* advance;

        expect(incrementalUpdate).toHaveBeenCalledTimes(1);
        const [changes] = incrementalUpdate.mock.calls[0];
        expect(changes.get('TestClass')).toBe('changed');
        expect(changes.get('NewClass')).toBe('created');
        expect(changes.get('OldClass')).toBe('deleted');
      })
    ));
});
