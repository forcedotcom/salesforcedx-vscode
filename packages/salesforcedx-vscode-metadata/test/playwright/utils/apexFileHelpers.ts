/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import { openFileByName, editOpenFile } from '@salesforce/playwright-vscode-ext';

/** Find and open an Apex class by name, then edit it */
export const findAndEditApexClass = async (page: Page, className: string, comment: string): Promise<void> => {
  await openFileByName(page, `${className}.cls`);
  await editOpenFile(page, comment);
};
