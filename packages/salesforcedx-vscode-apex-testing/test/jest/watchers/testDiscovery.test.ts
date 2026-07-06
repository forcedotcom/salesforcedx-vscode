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
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import { ApexTestDiscoveryService } from '../../../src/discoveryVfs/apexTestDiscoveryService';
import { initializeTestDiscovery } from '../../../src/watchers/testDiscovery';
import { closeForeignApexTestingTabs, getTestController } from '../../../src/views/testController';

// `closeForeignApexTestingTabs` is a module-level free function the watcher calls directly (org change
// passes the new orgId; logout passes undefined). It returns an Effect the reactor yields, so the mock
// returns Effect.void. Mock the module so we can assert those calls without pulling the real
// testController (vscode + runtime) into the watcher unit test.
jest.mock('../../../src/views/testController', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  return {
    closeForeignApexTestingTabs: jest.fn((_orgKey?: string) => EffectLib.void),
    getTestController: jest.fn()
  };
});

const closeForeignTabsMock = closeForeignApexTestingTabs as jest.MockedFunction<typeof closeForeignApexTestingTabs>;

type OrgInfo = { orgId?: string };

/**
 * The watcher subscribes to `TargetOrgRef.changes` and is forked into the test scope.
 * `SubscriptionRef.changes` emits the current value as element 0, so subscribing fires the initial
 * org once. Drive transitions with `SubscriptionRef.set` (NOT a PubSub). After each set, advance the
 * `TestClock` so the forked fiber drains deterministically before asserting.
 */
const setupHarness = Effect.fn('setupHarness')(function* (initial: OrgInfo) {
  const targetOrgRef = yield* SubscriptionRef.make<OrgInfo>(initial);

  const refresh = jest.fn<Promise<void>, []>(() => Promise.resolve());
  const clearAllTestItems = jest.fn<Promise<void>, []>(() => Promise.resolve());
  const testController = {
    refresh,
    clearAllTestItems
  } as unknown as ReturnType<typeof getTestController>;

  const appendToChannel = jest.fn(() => Effect.void);
  const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        TargetOrgRef: () => Effect.succeed(targetOrgRef),
        ChannelService: Effect.succeed({ appendToChannel })
      }
    })
  } as unknown as ExtensionProviderService);

  // `yield* api.services.ChannelService` resolves the `ChannelService` tag, so the watcher requires it in context.
  const channelLayer = Layer.succeed(ChannelService, { appendToChannel } as unknown as InstanceType<
    typeof ChannelService
  >);

  // `pruneForeignOrgClasses` runs for every non-undefined orgId; `clearAll` runs on the org -> undefined
  // (no-org) transition. Both return Effect.void here so the watcher's typed VFS-clear channel stays clean.
  const discoveryServiceLayer = Layer.succeed(ApexTestDiscoveryService, {
    pruneForeignOrgClasses: () => Effect.void,
    clearAll: () => Effect.void
  } as unknown as InstanceType<typeof ApexTestDiscoveryService>);

  yield* Effect.forkScoped(
    initializeTestDiscovery(testController).pipe(
      Effect.provide(Layer.mergeAll(extensionProviderLayer, channelLayer, discoveryServiceLayer))
    )
  );

  return { targetOrgRef, refresh, clearAllTestItems };
});

beforeEach(() => closeForeignTabsMock.mockClear());

// No debounce in the watcher; advance virtual time to let the forked fiber process the latest emission.
const settle = TestClock.adjust('1 milli');

const runTest = <A>(effect: Effect.Effect<A, unknown, Scope.Scope>) =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(TestContext.TestContext)));

describe('initializeTestDiscovery', () => {
  it('refreshes once for the initial org and closes foreign-org tabs scoped to that org', () =>
    runTest(
      Effect.gen(function* () {
        const { refresh, clearAllTestItems } = yield* setupHarness({ orgId: 'someOrg' });
        yield* settle;

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(clearAllTestItems).not.toHaveBeenCalled();
        // org present => close other orgs' stale tabs, scoped to the current orgId.
        expect(closeForeignTabsMock).toHaveBeenCalledWith('someOrg');
      })
    ));

  it('clears the tree and closes all org tabs when the org transitions to undefined', () =>
    runTest(
      Effect.gen(function* () {
        const { targetOrgRef, refresh, clearAllTestItems } = yield* setupHarness({ orgId: 'someOrg' });
        yield* settle;
        expect(refresh).toHaveBeenCalledTimes(1);

        yield* SubscriptionRef.set(targetOrgRef, { orgId: undefined });
        yield* settle;

        expect(clearAllTestItems).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenCalledTimes(1);
        // no org => undefined scope => every apex-testing: org tab is foreign and closes.
        expect(closeForeignTabsMock).toHaveBeenLastCalledWith(undefined);
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
