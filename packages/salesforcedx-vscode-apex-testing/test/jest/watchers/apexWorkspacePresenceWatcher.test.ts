/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Scope from 'effect/Scope';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import { FileChangePubSub, type FileChangeEvent } from 'salesforcedx-vscode-services/src/vscode/fileChangePubSub';
import { URI } from 'vscode-uri';
import { setupApexWorkspacePresenceWatcher } from '../../../src/watchers/apexWorkspacePresenceWatcher';

const setupHarness = Effect.fn('setupHarness')(function* () {
  const pubsub = yield* PubSub.unbounded<FileChangeEvent>({ replay: 16 });
  const refresh = jest.fn<Promise<void>, []>(() => Promise.resolve());
  const testController = { refresh } as unknown as Parameters<typeof setupApexWorkspacePresenceWatcher>[0];
  const fileChangeLayer = Layer.succeed(FileChangePubSub, pubsub as unknown as InstanceType<typeof FileChangePubSub>);
  const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        FileChangePubSub
      }
    })
  } as unknown as ExtensionProviderService);

  yield* Effect.forkScoped(
    setupApexWorkspacePresenceWatcher(testController).pipe(
      Effect.provide(Layer.merge(fileChangeLayer, extensionProviderLayer))
    )
  );
  return { pubsub, refresh };
});

const runTest = <A>(effect: Effect.Effect<A, unknown, Scope.Scope>) =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(TestContext.TestContext)));

const fileEvent = (type: FileChangeEvent['type'], path: string): FileChangeEvent => ({
  type,
  uri: URI.file(path)
});

describe('setupApexWorkspacePresenceWatcher', () => {
  it.each(['create', 'delete'] as const)('refreshes after a .cls %s event', changeType =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, refresh } = yield* setupHarness();
        yield* PubSub.publish(pubsub, fileEvent(changeType, '/workspace/FooTest.cls'));

        expect(refresh).not.toHaveBeenCalled();
        yield* TestClock.adjust('300 millis');

        expect(refresh).toHaveBeenCalledTimes(1);
      })
    )
  );

  it('ignores content changes and non-Apex files', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, refresh } = yield* setupHarness();
        yield* PubSub.publish(pubsub, fileEvent('change', '/workspace/FooTest.cls'));
        yield* PubSub.publish(pubsub, fileEvent('delete', '/workspace/FooTest.cls-meta.xml'));
        yield* TestClock.adjust('300 millis');

        expect(refresh).not.toHaveBeenCalled();
      })
    ));

  it('coalesces a burst of Apex presence changes', () =>
    runTest(
      Effect.gen(function* () {
        const { pubsub, refresh } = yield* setupHarness();
        yield* PubSub.publish(pubsub, fileEvent('delete', '/workspace/FooTest.cls'));
        yield* PubSub.publish(pubsub, fileEvent('create', '/workspace/BarTest.cls'));
        yield* TestClock.adjust('300 millis');

        expect(refresh).toHaveBeenCalledTimes(1);
      })
    ));
});
