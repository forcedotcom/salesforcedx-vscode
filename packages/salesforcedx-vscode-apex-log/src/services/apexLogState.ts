/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { TraceFlagItem } from 'salesforcedx-vscode-services';

export type LogCollectorState = {
  readonly isCollecting: boolean;
  readonly collectedCount: number;
};

const initialState: LogCollectorState = { isCollecting: false, collectedCount: 0 };

// updates when the trace flags change, usually as a result of commands being run
export const CurrentTraceFlags = Context.GenericTag<SubscriptionRef.SubscriptionRef<TraceFlagItem[]>>(
  'TraceFlagRefreshSubscriptionRef'
);
export const LogCollectorStateRef =
  Context.GenericTag<SubscriptionRef.SubscriptionRef<LogCollectorState>>('LogCollectorStateRef');

/** Module-level singletons. Commands run in separate Effect.runFork; layer memoization is per-run, so we'd get distinct PubSub/Ref per run. These ensure status bar (activation run) and commands (command run) share the same instances. */
// eslint-disable-next-line functional/no-let -- singleton for cross-run sharing
let traceFlagRefreshSubscriptionRefInstance: SubscriptionRef.SubscriptionRef<TraceFlagItem[]> | undefined;
// eslint-disable-next-line functional/no-let -- singleton for cross-run sharing
let logCollectorStateRefInstance: SubscriptionRef.SubscriptionRef<LogCollectorState> | undefined;

const createLogCollectorStateRef = () => SubscriptionRef.make(initialState);

const initialTraceFlags: TraceFlagItem[] = [];

export const getOrCreateTraceFlagRefreshSubscriptionRef = (): SubscriptionRef.SubscriptionRef<TraceFlagItem[]> =>
  (traceFlagRefreshSubscriptionRefInstance ??= Effect.runSync(SubscriptionRef.make(initialTraceFlags)));

export const getOrCreateLogCollectorStateRef = (): SubscriptionRef.SubscriptionRef<LogCollectorState> =>
  (logCollectorStateRefInstance ??= Effect.runSync(createLogCollectorStateRef()));
