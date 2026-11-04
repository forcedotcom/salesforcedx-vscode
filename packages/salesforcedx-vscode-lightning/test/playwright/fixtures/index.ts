/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { containerTest } from './containerFixtures';
import { noOrgDesktopTest } from './desktopFixtures';

export const isContainer = process.env.VSCODE_CONTAINER === '1';

/** Runs on `noOrgDesktopTest` normally; on `containerTest` when driving the Code Builder container. */
export const test = isContainer ? containerTest : noOrgDesktopTest;
