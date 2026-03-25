/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { getSoqlRuntime } from './extensionProvider';

/** TargetOrgRef (getDefaultOrgRef) has no requirements */
export const isDefaultOrgSet = (): Promise<boolean> =>
  getSoqlRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* getServicesApi;
      return yield* api.services.TargetOrgRef().pipe(
        Effect.flatMap(ref => SubscriptionRef.get(ref)),
        Effect.map(info => Boolean(info?.username))
      );
    })
  );

/**
 * Calls `listener` whenever the default org changes. Returns a `Disposable` for cleanup.
 * Skips the initial current value — only fires on subsequent changes.
 */
export const onDefaultOrgChange = (listener: () => void): vscode.Disposable => {
  const abortController = new AbortController();
  void getSoqlRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* getServicesApi;
      const ref = yield* api.services.TargetOrgRef();
      yield* ref.changes.pipe(Stream.runForEach(() => Effect.sync(listener)));
    }),
    { signal: abortController.signal }
  );
  return new vscode.Disposable(() => abortController.abort());
};

export const getConnection = (): Promise<Connection> =>
  getSoqlRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* getServicesApi;
      const connectionService = yield* api.services.ConnectionService;
      return yield* connectionService.getConnection();
    })
  );
