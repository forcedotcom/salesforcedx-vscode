/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgShape } from './workspaceContextUtil';

export type OrgShapeInfo = { isScratch?: boolean; isSandbox?: boolean; alias?: string; username?: string };

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
