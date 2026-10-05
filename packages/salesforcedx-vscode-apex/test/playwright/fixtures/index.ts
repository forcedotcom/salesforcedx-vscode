/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';
import { containerTest } from './containerFixtures';
import { desktopTest, snippetDesktopTest } from './desktopFixtures';
import { outlineDesktopTest } from './outlineFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';

// Unchanged from before: every existing desktop-only spec imports this, typed purely as the desktop
// test (which has desktop-only fixtures like `workspaceDir` that `containerTest` doesn't declare).
// Widening this to a union would break those specs' types, so specs shared with container use the
// separately-typed exports below instead.
export { desktopTest as test } from './desktopFixtures';

export const isContainer = process.env.VSCODE_CONTAINER === '1';

/** For specs shared with container mode only (no `workspaceDir`, so not the plain `test` above). */
export const sharedTest = isContainer ? containerTest : desktopTest;

/** Same as `sharedTest`, but for the snippets spec's marketplace-extension desktop fixture. */
export const sharedSnippetTest = isContainer ? containerTest : snippetDesktopTest;

// Desktop specs take `workspaceDir` from desktopTest. A ternary with the base Playwright test
// erases that fixture from the type. The outline spec is the one that runs on both targets.
export const outlineTest = isDesktop ? outlineDesktopTest : webTest;
