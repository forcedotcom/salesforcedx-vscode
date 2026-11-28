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
import type * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as TestClock from 'effect/testing/TestClock';
import {
  ChannelService,
  OrgMetadataCatalogChangePubSub,
  TargetOrgRef,
  type DefaultOrgInfo,
  type OrgMetadataCatalogChange
} from '@salesforce/vscode-services/v2';
import { URI } from 'vscode-uri';
import { initializeTestDiscovery } from '../../../src/watchers/testDiscovery';
import { type getTestController } from '../../../src/views/testController';

vi.mock('../../../src/views/testController', () => ({
  getTestController: vi.fn()
}));

/**
 * The watcher subscribes to `TargetOrgRef.changes` and is forked into the test scope.
 * `SubscriptionRef.changes` emits the current value as element 0, so subscribing fires the initial
 * org once. Drive transitions with `SubscriptionRef.set` (NOT a PubSub). After each set, advance the
 * `TestClock` so the forked fiber drains deterministically before asserting.
 */
const setupHarness = Effect.fn('setupHarness')(function* (initial: DefaultOrgInfo, discoveryRequested = true) {
  let requested = discoveryRequested;
  const targetOrgRef = yield* SubscriptionRef.make<DefaultOrgInfo>(initial);
  const catalogChanges = yield* PubSub.sliding<OrgMetadataCatalogChange>(100);

  const refresh = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const clearAllTestItems = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const incrementalUpdate = vi.fn<(_files: Map<string, string>, _replace: boolean) => Promise<void>>(() =>
    Promise.resolve()
  );
  const testController = {
    refresh,
    clearAllTestItems,
    incrementalUpdate,
    isDiscoveryRequested: () => requested
  } as unknown as ReturnType<typeof getTestController>;

  const appendToChannel = vi.fn(() => Effect.void);
  const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      v2: {
        services: {
          TargetOrgRef,
          ChannelService,
          OrgMetadataCatalogChangePubSub
        }
      }
    })
  } as unknown as ExtensionProviderService['Service']);

  // `yield* api.v2.services.ChannelService` resolves the `ChannelService` tag, so the watcher requires it in context.
  const channelLayer = Layer.succeed(ChannelService, { appendToChannel } as unknown as ChannelService['Service']);
  const catalogChangesLayer = Layer.succeed(OrgMetadataCatalogChangePubSub, catalogChanges);
  const targetOrgLayer = Layer.succeed(TargetOrgRef, targetOrgRef);

  yield* Effect.forkScoped(
    initializeTestDiscovery(testController).pipe(
      Effect.provide(Layer.mergeAll(extensionProviderLayer, channelLayer, catalogChangesLayer, targetOrgLayer))
    )
  );

  return {
    targetOrgRef,
    catalogChanges,
    refresh,
    clearAllTestItems,
    incrementalUpdate,
    requestDiscovery: () => {
      requested = true;
    }
  };
});

// No debounce in the watcher; advance virtual time to let the forked fiber process the latest emission.
const settle = TestClock.adjust('1 milli');

const runTest = <A>(effect: Effect.Effect<A, unknown, Scope.Scope>) =>
  Effect.runPromise(Effect.scoped(Effect.provide(effect, TestClock.layer())));

describe('initializeTestDiscovery', () => {
  it('does not discover or update tests before discovery is requested', () =>
    runTest(
      Effect.gen(function* () {
        const { targetOrgRef, catalogChanges, refresh, incrementalUpdate, requestDiscovery } = yield* setupHarness(
          { orgId: '00D000000000001' as DefaultOrgInfo['orgId'] },
          false
        );
        yield* settle;
        expect(refresh).not.toHaveBeenCalled();

        yield* PubSub.publish(catalogChanges, {
          kind: 'workspace',
          events: [{ type: 'create', uri: URI.file('/workspace/force-app/main/default/classes/MyTest.cls') }]
        });
        yield* settle;
        expect(incrementalUpdate).not.toHaveBeenCalled();

        requestDiscovery();
        yield* SubscriptionRef.set(targetOrgRef, { orgId: '00D000000000002' as DefaultOrgInfo['orgId'] });
        yield* settle;
        expect(refresh).toHaveBeenCalledTimes(1);
      })
    ));

  it('refreshes once for the initial org', () =>
    runTest(
      Effect.gen(function* () {
        const { refresh, clearAllTestItems } = yield* setupHarness({
          orgId: '00D000000000001' as DefaultOrgInfo['orgId']
        });
        yield* settle;

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(clearAllTestItems).not.toHaveBeenCalled();
      })
    ));

  it('clears the tree when the org transitions to undefined', () =>
    runTest(
      Effect.gen(function* () {
        const { targetOrgRef, refresh, clearAllTestItems } = yield* setupHarness({
          orgId: '00D000000000001' as DefaultOrgInfo['orgId']
        });
        yield* settle;
        expect(refresh).toHaveBeenCalledTimes(1);

        yield* SubscriptionRef.set(targetOrgRef, {});
        yield* settle;

        expect(clearAllTestItems).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenCalledTimes(1);
      })
    ));

  it('refreshes again when the org returns after being undefined', () =>
    runTest(
      Effect.gen(function* () {
        const { targetOrgRef, refresh, clearAllTestItems } = yield* setupHarness({});
        yield* settle;
        // element-0 snapshot is undefined: clears once on subscribe, no refresh yet
        expect(refresh).not.toHaveBeenCalled();
        expect(clearAllTestItems).toHaveBeenCalledTimes(1);

        yield* SubscriptionRef.set(targetOrgRef, { orgId: '00D000000000001' as DefaultOrgInfo['orgId'] });
        yield* settle;
        expect(refresh).toHaveBeenCalledTimes(1);

        yield* SubscriptionRef.set(targetOrgRef, {});
        yield* settle;
        expect(clearAllTestItems).toHaveBeenCalledTimes(2);

        yield* SubscriptionRef.set(targetOrgRef, { orgId: '00D000000000001' as DefaultOrgInfo['orgId'] });
        yield* settle;
        expect(refresh).toHaveBeenCalledTimes(2);
      })
    ));

  it('incrementally updates when an Apex class is created or deleted in the workspace', () =>
    runTest(
      Effect.gen(function* () {
        const { catalogChanges, refresh, incrementalUpdate } = yield* setupHarness({
          orgId: '00D000000000001' as DefaultOrgInfo['orgId']
        });
        yield* settle;
        expect(refresh).toHaveBeenCalledTimes(1);

        yield* PubSub.publish(catalogChanges, {
          kind: 'workspace',
          events: [
            {
              type: 'delete',
              uri: URI.file('/workspace/force-app/main/default/classes/MyTest.cls')
            }
          ]
        });
        yield* settle;

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(incrementalUpdate).toHaveBeenCalledTimes(1);
        expect(incrementalUpdate).toHaveBeenCalledWith(new Map([['MyTest', 'workspacePresence']]), false);
      })
    ));

  it('coalesces relevant workspace events into one targeted update', () =>
    runTest(
      Effect.gen(function* () {
        const { catalogChanges, incrementalUpdate } = yield* setupHarness({
          orgId: '00D000000000001' as DefaultOrgInfo['orgId']
        });
        yield* settle;

        yield* PubSub.publish(catalogChanges, {
          kind: 'workspace',
          events: [
            {
              type: 'create',
              uri: URI.file('/workspace/force-app/main/default/classes/FooTest.cls')
            },
            {
              type: 'create',
              uri: URI.file('/workspace/force-app/main/default/classes/FooTest.cls-meta.xml')
            },
            {
              type: 'delete',
              uri: URI.file('/workspace/force-app/main/default/classes/OldTest.cls')
            }
          ]
        });
        yield* settle;

        expect(incrementalUpdate).toHaveBeenCalledTimes(1);
        expect(incrementalUpdate).toHaveBeenCalledWith(
          new Map([
            ['FooTest', 'workspacePresence'],
            ['OldTest', 'workspacePresence']
          ]),
          false
        );
      })
    ));

  it('reconciles Apex class presence when only its sidecar notification is observed', () =>
    runTest(
      Effect.gen(function* () {
        const { catalogChanges, incrementalUpdate } = yield* setupHarness({
          orgId: '00D000000000001' as DefaultOrgInfo['orgId']
        });
        yield* settle;

        yield* PubSub.publish(catalogChanges, {
          kind: 'workspace',
          events: [
            {
              type: 'delete',
              uri: URI.file('/workspace/force-app/main/default/classes/MyTest.cls-meta.xml')
            }
          ]
        });
        yield* settle;

        expect(incrementalUpdate).toHaveBeenCalledWith(new Map([['MyTest', 'workspacePresence']]), false);
      })
    ));

  it('does not update for workspace changes that cannot alter Apex class presence', () =>
    runTest(
      Effect.gen(function* () {
        const { catalogChanges, refresh, incrementalUpdate } = yield* setupHarness({
          orgId: '00D000000000001' as DefaultOrgInfo['orgId']
        });
        yield* settle;

        yield* PubSub.publish(catalogChanges, {
          kind: 'workspace',
          events: [
            {
              type: 'change',
              uri: URI.file('/workspace/force-app/main/default/classes/MyTest.cls')
            }
          ]
        });
        yield* PubSub.publish(catalogChanges, {
          kind: 'workspace',
          events: [
            {
              type: 'delete',
              uri: URI.file('/workspace/force-app/main/default/objects/Account.object-meta.xml')
            }
          ]
        });
        yield* settle;

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(incrementalUpdate).not.toHaveBeenCalled();
      })
    ));
});
