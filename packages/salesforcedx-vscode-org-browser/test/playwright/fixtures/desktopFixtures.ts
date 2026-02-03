/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, DREAMHOUSE_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

// all tests use dreamhouse org
export const test = createDesktopTest({ fixturesDir: __dirname, orgAlias: DREAMHOUSE_ORG_ALIAS });
