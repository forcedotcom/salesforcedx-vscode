/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SObjectShortDescription } from '../describe/types';
import { SObjectCategory, SObjectRefreshSource } from '../types';

/** filter out standard or custom if necessary and handle the "required" sobject types */
export const sobjectTypeFilter =
  (category: SObjectCategory, source: SObjectRefreshSource) => (sobject: SObjectShortDescription) => {
    const isCustomObject = sobject.custom === true && category === 'CUSTOM';
    const isStandardObject = sobject.custom === false && category === 'STANDARD';

    if (category === 'ALL' && source === 'manual') {
      return true;
    } else if (
      category === 'ALL' &&
      (source === 'startupmin' || source === 'startup') &&
      isRequiredSObject(sobject.name)
    ) {
      return true;
    } else if ((isCustomObject || isStandardObject) && source === 'manual' && isRequiredSObject(sobject.name)) {
      return true;
    }
    return false;
  };

/* Ignore all sobjects that end with Share or History or Feed or Event */
const isRequiredSObject = (sobject: string): boolean => !/Share$|History$|Feed$|.+Event$/.test(sobject);
