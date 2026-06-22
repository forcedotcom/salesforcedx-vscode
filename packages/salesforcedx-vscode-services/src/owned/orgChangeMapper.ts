/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgChange } from './changes';
import type { ChangeResult } from '@salesforce/source-tracking';

/**
 * Maps a source-tracking ChangeResult to owned OrgChange format.
 * Extracts the first filename from the filenames array if present.
 */
export const toOrgChange = (change: ChangeResult): OrgChange => {
  const base: OrgChange = {
    fullName: change.name ?? '',
    type: change.type ?? '',
    state: change.origin
  };

  // Extract first filename if present
  const firstFile = change.filenames?.[0];
  if (firstFile) {
    return { ...base, filePath: firstFile };
  }

  return base;
};
