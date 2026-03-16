/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SObject } from 'salesforcedx-vscode-services';

export type SObjectCategory = 'ALL' | 'STANDARD' | 'CUSTOM';

export type SObjectRefreshSource = 'manual' | 'startup' | 'startupmin';

export type FieldDeclaration = {
  modifier: string;
  type: string;
  name: string;
  comment?: string;
};

export type SObjectDefinition = Pick<SObject, 'name'> & {
  fields: FieldDeclaration[];
};
