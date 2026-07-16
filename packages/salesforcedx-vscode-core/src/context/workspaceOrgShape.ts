/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { OrgShape, shapeFrom } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { getRuntime } from '../services/runtime';
import { getDefaultOrgInfo } from './defaultOrgInfo';

const getOrgShapeEffect = Effect.fn('workspaceOrgShape.getOrgShape')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { isEmpty } = yield* api.services.WorkspaceService.getWorkspaceInfo();
  if (isEmpty) return 'Undefined';
  const info = yield* getDefaultOrgInfo();
  return shapeFrom(info);
});

export const getOrgShape = async (_username: string): Promise<OrgShape> =>
  getRuntime().runPromise(getOrgShapeEffect().pipe(Effect.catchAll(() => Effect.succeed<OrgShape>('Undefined'))));
