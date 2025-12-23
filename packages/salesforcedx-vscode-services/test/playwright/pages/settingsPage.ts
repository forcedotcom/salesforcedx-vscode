/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import { upsertSettings } from '@salesforce/playwright-vscode-ext';
import { CODE_BUILDER_WEB_SECTION, RETRIEVE_ON_LOAD_KEY } from '../../../src/constants';

/** Sets the retrieveOnLoad setting via Settings UI */
export const upsertRetrieveOnLoadSetting = async (page: Page, value: string): Promise<void> => {
  const settingId = `${CODE_BUILDER_WEB_SECTION}.${RETRIEVE_ON_LOAD_KEY}`;
  await upsertSettings(page, { [settingId]: value });
};
