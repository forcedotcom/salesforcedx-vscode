/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SObject } from '@salesforce/vscode-services/v2';

export type SObjectShortDescription = Pick<SObject, 'name' | 'custom'>;

export type SObjectsStandardAndCustom = { standard: SObject[]; custom: SObject[] };
