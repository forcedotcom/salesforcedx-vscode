/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as SubscriptionRef from 'effect/SubscriptionRef';

export type LogCollectorState = {
  readonly isCollecting: boolean;
  readonly collectedCount: number;
};

export const initialState: LogCollectorState = { isCollecting: false, collectedCount: 0 };

export const TraceFlagRefreshPubSub = Context.GenericTag<PubSub.PubSub<void>>('TraceFlagRefreshPubSub');
export const LogCollectorStateRef = Context.GenericTag<SubscriptionRef.SubscriptionRef<LogCollectorState>>(
  'LogCollectorStateRef'
);

/** Module-level singletons. Commands run in separate Effect.runFork; layer memoization is per-run, so we'd get distinct PubSub/Ref per run. These ensure status bar (activation run) and commands (command run) share the same instances. */
// eslint-disable-next-line functional/no-let -- singleton for cross-run sharing
let traceFlagRefreshPubSubInstance: PubSub.PubSub<void> | undefined;
// eslint-disable-next-line functional/no-let -- singleton for cross-run sharing
let logCollectorStateRefInstance: SubscriptionRef.SubscriptionRef<LogCollectorState> | undefined;

export const createLogCollectorStateRef = () => SubscriptionRef.make(initialState);

export const getOrCreateTraceFlagRefreshPubSub = (): PubSub.PubSub<void> =>
  (traceFlagRefreshPubSubInstance ??= Effect.runSync(PubSub.sliding<void>(1)));

export const getOrCreateLogCollectorStateRef = (): SubscriptionRef.SubscriptionRef<LogCollectorState> =>
  (logCollectorStateRefInstance ??= Effect.runSync(createLogCollectorStateRef()));
