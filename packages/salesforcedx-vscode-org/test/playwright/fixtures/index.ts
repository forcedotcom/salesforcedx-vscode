/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { containerTest } from './containerFixtures';
import { orgDesktopMinimalDefaultTest, orgDesktopTest } from './desktopFixtures';

export const isContainer = process.env.VSCODE_CONTAINER === '1';

/** For specs that need no org (palette command-presence only). */
export const sharedNoOrgTest = isContainer ? containerTest : orgDesktopTest;

/** For specs that need a default org (scratch org on desktop, the boot org in the container). */
export const sharedMinimalDefaultTest = isContainer ? containerTest : orgDesktopMinimalDefaultTest;
