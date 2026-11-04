/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services';
import { getRuntime } from '../services/runtime';
import { getDefaultOrgInfo } from './defaultOrgInfo';

export type OrgShape = 'Scratch' | 'Sandbox' | 'Production' | 'Undefined';
type OrgShapeInfo = Pick<typeof DefaultOrgInfoSchema.Type, 'isScratch' | 'isSandbox' | 'alias' | 'username'>;

/** Maps DefaultOrgInfo fields to their org shape. */
export const shapeFrom = (info: OrgShapeInfo): OrgShape => {
  if (info.isScratch) return 'Scratch';
  if (info.isSandbox) return 'Sandbox';
  if (info.alias ?? info.username) return 'Production';
  return 'Undefined';
};

const getOrgShapeEffect = Effect.fn('workspaceOrgShape.getOrgShape')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { isEmpty } = yield* api.services.WorkspaceService.getWorkspaceInfo();
  if (isEmpty) return 'Undefined';
  return yield* getDefaultOrgInfo().pipe(Effect.map(shapeFrom));
});

export const getOrgShape = async (_username: string): Promise<OrgShape> =>
  getRuntime().runPromise(getOrgShapeEffect().pipe(Effect.catchAll(() => Effect.succeed<OrgShape>('Undefined'))));
