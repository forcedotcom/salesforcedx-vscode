/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataListResultItem } from './types';

/** Filter for components with valid fullName */
const hasFullName = (i: MetadataListResultItem): boolean => Boolean(i.fullName);

/** Filter for components with supported manageable state */
const isSupportedManageableState = (i: MetadataListResultItem): boolean =>
  !i.manageableState || ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(i.manageableState);

/** Combined filter for all listMetadata results */
export const isRetrievableComponent = (i: MetadataListResultItem): boolean =>
  hasFullName(i) && isSupportedManageableState(i);
