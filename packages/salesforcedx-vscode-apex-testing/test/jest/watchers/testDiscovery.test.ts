/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import { initializeTestDiscovery } from '../../../src/watchers/testDiscovery';
import { getTestController } from '../../../src/views/testController';

type OrgInfo = { orgId?: string };

/**
 * The watcher subscribes to `TargetOrgRef.changes` and forks a daemon fiber. `SubscriptionRef.changes`
 * emits the current value as element 0, so subscribing fires the initial org once. Drive transitions
 * with `SubscriptionRef.set` (NOT a PubSub). After each set, yield so the daemon fiber drains before asserting.
 */
const setupHarness = Effect.fn('setupHarness')(function* (initial: OrgInfo) {
  const targetOrgRef = yield* SubscriptionRef.make<OrgInfo>(initial);

  const refresh = jest.fn<Promise<void>, []>(() => Promise.resolve());
  const clearAllTestItems = jest.fn<Promise<void>, []>(() => Promise.resolve());
  const testController = { refresh, clearAllTestItems } as unknown as ReturnType<typeof getTestController>;

  const appendToChannel = jest.fn(() => Effect.void);
  const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        TargetOrgRef: () => Effect.succeed(targetOrgRef),
        ChannelService: Effect.succeed({ appendToChannel })
      }
    })
  } as any);

  const channelLayer = Layer.succeed(ChannelService, { appendToChannel } as unknown as InstanceType<
    typeof ChannelService
  >);

  yield* initializeTestDiscovery(testController).pipe(
    Effect.provide(Layer.mergeAll(extensionProviderLayer, channelLayer))
  );

  return { targetOrgRef, refresh, clearAllTestItems };
});

const settle = Effect.sleep('20 millis');

const runTest = <A>(effect: Effect.Effect<A, unknown, Scope.Scope>) => Effect.runPromise(effect.pipe(Effect.scoped));

describe('initializeTestDiscovery', () => {
  it('refreshes once for the initial org and does not clear', () =>
    runTest(
      Effect.gen(function* () {
        const { refresh, clearAllTestItems } = yield* setupHarness({ orgId: 'someOrg' });
        yield* settle;

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(clearAllTestItems).not.toHaveBeenCalled();
      })
    ));

  it('clears the tree when the org transitions to undefined and does not refresh again', () =>
    runTest(
      Effect.gen(function* () {
        const { targetOrgRef, refresh, clearAllTestItems } = yield* setupHarness({ orgId: 'someOrg' });
        yield* settle;
        expect(refresh).toHaveBeenCalledTimes(1);

        yield* SubscriptionRef.set(targetOrgRef, { orgId: undefined });
        yield* settle;

        expect(clearAllTestItems).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenCalledTimes(1);
      })
    ));

  it('refreshes again when the org returns after being undefined', () =>
    runTest(
      Effect.gen(function* () {
        const { targetOrgRef, refresh, clearAllTestItems } = yield* setupHarness({ orgId: undefined });
        yield* settle;
        // element-0 snapshot is undefined: clears once on subscribe, no refresh yet
        expect(refresh).not.toHaveBeenCalled();
        expect(clearAllTestItems).toHaveBeenCalledTimes(1);

        yield* SubscriptionRef.set(targetOrgRef, { orgId: 'someOrg' });
        yield* settle;
        expect(refresh).toHaveBeenCalledTimes(1);

        yield* SubscriptionRef.set(targetOrgRef, { orgId: undefined });
        yield* settle;
        expect(clearAllTestItems).toHaveBeenCalledTimes(2);

        yield* SubscriptionRef.set(targetOrgRef, { orgId: 'someOrg' });
        yield* settle;
        expect(refresh).toHaveBeenCalledTimes(2);
      })
    ));
});
