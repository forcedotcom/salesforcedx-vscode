/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { OrgShape, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { getRuntime } from '../services/runtime';

const shapeFrom = (info: { isScratch?: boolean; isSandbox?: boolean; alias?: string; username?: string }): OrgShape =>
  info.isScratch ? 'Scratch' : info.isSandbox ? 'Sandbox' : (info.alias ?? info.username) ? 'Production' : 'Undefined';

export const getOrgShape = async (_username: string): Promise<OrgShape> => {
  if (!workspaceUtils.hasRootWorkspace()) return 'Undefined';
  return getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const ref = yield* api.services.TargetOrgRef();
      const info = yield* SubscriptionRef.get(ref);
      return shapeFrom(info);
    }).pipe(Effect.catchAll(() => Effect.succeed<OrgShape>('Undefined')))
  );
};
