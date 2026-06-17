/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { OrgShape } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { getRuntime } from '../services/runtime';
import { getDefaultOrgInfo } from './defaultOrgInfo';

type OrgShapeInfo = { isScratch?: boolean; isSandbox?: boolean; alias?: string; username?: string };

/**
 * Maps DefaultOrgInfo fields from `defaultOrgRef` to an OrgShape literal.
 * Precedence: Scratch > Sandbox > Production (when alias or username known) > Undefined.
 * Exported for unit-test coverage of the precedence mapping.
 */
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
  const info = yield* getDefaultOrgInfo();
  return shapeFrom(info);
});

export const getOrgShape = async (_username: string): Promise<OrgShape> =>
  getRuntime().runPromise(getOrgShapeEffect().pipe(Effect.catchAll(() => Effect.succeed<OrgShape>('Undefined'))));
