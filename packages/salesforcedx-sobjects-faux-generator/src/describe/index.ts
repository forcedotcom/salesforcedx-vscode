/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SObject } from '../types';
export { SObjectDescribe, toMinimalSObject } from './sObjectDescribe';

export type SObjectShortDescription = Pick<SObject, 'name' | 'custom'>;

export interface SObjectSelector {
  select(sobject: SObjectShortDescription): boolean;
}
