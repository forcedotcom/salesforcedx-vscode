/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  createDesktopTest,
  DREAMHOUSE_ORG_ALIAS,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS
} from '@salesforce/playwright-vscode-ext';

export const desktopTest = createDesktopTest({ fixturesDir: __dirname, orgAlias: MINIMAL_ORG_ALIAS });
export const dreamhouseDesktopTest = createDesktopTest({ fixturesDir: __dirname, orgAlias: DREAMHOUSE_ORG_ALIAS });
export const nonTrackingDesktopTest = createDesktopTest({ fixturesDir: __dirname, orgAlias: NON_TRACKING_ORG_ALIAS });
