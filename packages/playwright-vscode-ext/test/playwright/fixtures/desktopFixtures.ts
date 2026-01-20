/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest } from '../../../src/fixtures/createDesktopTest';

// here we don't need an org alias because we're not using any orgs
export const test = createDesktopTest({ fixturesDir: __dirname });
