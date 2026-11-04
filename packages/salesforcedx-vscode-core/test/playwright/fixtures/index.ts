/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { containerTest } from './containerFixtures';
import { desktopTest } from './desktopFixtures';

export const isContainer = process.env.VSCODE_CONTAINER === '1';

// Core Playwright tests are desktop-only (no web variant); this is for the handful that also share
// coverage with container. Runs on `desktopTest` normally; on `containerTest` in container mode.
export const test = isContainer ? containerTest : desktopTest;
