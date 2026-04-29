/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Scope from 'effect/Scope';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import { MetadataChangeNotificationService, type MetadataChangeEventType } from 'salesforcedx-vscode-services';
import { URI } from 'vscode-uri';
import { setupApexMetadataChangeWatcher } from '../../../src/watchers/apexMetadataChangeWatcher';

const FsServiceTag = Context.GenericTag<{ readFile: (uri: unknown) => Effect.Effect<string> }>('FsService');

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
 * `TestClock.adjust` already calls `awaitSuspended` internally, so no manual fiber-yield flushing is needed.
 */
const setupHarness = Effect.fn('setupHarness')(function* (readFileResponses: Map<string, string> = new Map()) {
  const pubsub = yield* PubSub.unbounded<MetadataChangeEventType>({ replay: 16 });
  const discoverTests = jest.fn(() => Promise.resolve());
  const testController = { discoverTests } as unknown as Parameters<typeof setupApexMetadataChangeWatcher>[0];

  const readFileFn = jest.fn((uri: unknown) => Effect.succeed(readFileResponses.get(String(uri)) ?? NON_TEST_CONTENT));

  const notificationLayer = Layer.succeed(MetadataChangeNotificationService, { pubsub } as any);
  const fsLayer = Layer.succeed(FsServiceTag, { readFile: readFileFn });
  const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        MetadataChangeNotificationService,
        FsService: FsServiceTag
      }
    })
  } as any);

  // FsServiceTag identifier matches the real FsService at runtime, but TS sees them as different
  const provided = setupApexMetadataChangeWatcher(testController).pipe(
    Effect.provide(Layer.mergeAll(notificationLayer, fsLayer, extensionProviderLayer))
  ) as unknown as Effect.Effect<void>;
  yield* Effect.forkScoped(provided);

  return { pubsub, discoverTests, readFileFn };
});

const advance = TestClock.adjust(DEBOUNCE_PLUS_MARGIN);

const runTest = <A>(effect: Effect.Effect<A, unknown, Scope.Scope>) =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(TestContext.TestContext)));

describe('setupApexMetadataChangeWatcher', () => {
  it('calls discoverTests after debounce when an apex test event arrives', () =>
    runTest(
      Effect.gen(function* () {
        const responses = new Map([[URI.file('/tmp/MyClass.cls').toString(), APEX_TEST_CONTENT]]);
        const { pubsub, discoverTests } = yield* setupHarness(responses);

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexClass' }));
        yield* advance;

        expect(discoverTests).toHaveBeenCalledTimes(1);
      })
    ));

  it('does not call discoverTests for non-apex metadata types', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, discoverTests } = yield* setupHarness();

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'LightningComponentBundle' }));
        yield* advance;

        expect(discoverTests).not.toHaveBeenCalled();
      })
    ));

  it('does not call discoverTests for non-apex change types', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, discoverTests } = yield* setupHarness();

        yield* PubSub.publish(
          pubsub,
          makeEvent({ metadataType: 'ApexClass', changeType: 'unchanged' as MetadataChangeEventType['changeType'] })
        );
        yield* advance;

        expect(discoverTests).not.toHaveBeenCalled();
      })
    ));

  it('does not read files for deleted events but still triggers discoverTests', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, readFileFn, discoverTests } = yield* setupHarness();

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexClass', changeType: 'deleted' }));
        yield* advance;

        expect(readFileFn).not.toHaveBeenCalled();
        expect(discoverTests).toHaveBeenCalledTimes(1);
      })
    ));

  it('does not read files for ApexTestSuite events but still triggers discoverTests', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, readFileFn, discoverTests } = yield* setupHarness();

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexTestSuite' }));
        yield* advance;

        expect(readFileFn).not.toHaveBeenCalled();
        expect(discoverTests).toHaveBeenCalledTimes(1);
      })
    ));

  it('skips file reads after first passing event in a burst', () =>
    runTest(
      Effect.gen(function* () {
        const testUri = URI.file('/tmp/TestClass.cls');
        const nonTestUri = URI.file('/tmp/Helper.cls');
        const responses = new Map([[testUri.toString(), APEX_TEST_CONTENT]]);
        const { pubsub, readFileFn, discoverTests } = yield* setupHarness(responses);

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexClass', fileUri: Option.some(testUri) }));
        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexClass', fileUri: Option.some(nonTestUri) }));
        yield* advance;

        expect(readFileFn).toHaveBeenCalledTimes(1);
        expect(discoverTests).toHaveBeenCalledTimes(1);
      })
    ));

  it('resets the willRefresh ref after refresh so subsequent bursts are processed', () =>
    runTest(
      Effect.gen(function* () {
        const testUri = URI.file('/tmp/TestClass.cls');
        const responses = new Map([[testUri.toString(), APEX_TEST_CONTENT]]);
        const { pubsub, discoverTests } = yield* setupHarness(responses);

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexClass', fileUri: Option.some(testUri) }));
        yield* advance;
        expect(discoverTests).toHaveBeenCalledTimes(1);

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexClass', fileUri: Option.some(testUri) }));
        yield* advance;
        expect(discoverTests).toHaveBeenCalledTimes(2);
      })
    ));

  it('does not call discoverTests when no events pass the apex test filter', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, discoverTests } = yield* setupHarness();

        yield* PubSub.publish(pubsub, makeEvent({ metadataType: 'ApexClass' }));
        yield* advance;

        expect(discoverTests).not.toHaveBeenCalled();
      })
    ));
});
