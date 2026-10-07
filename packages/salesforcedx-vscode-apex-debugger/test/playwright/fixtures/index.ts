/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { containerTest } from './containerFixtures';
import { debuggerDesktopTest } from './desktopFixtures';

export { debuggerEmptyWorkspaceDesktopTest } from './desktopFixtures';

// Container's org is boot-authed by the orchestrator, so a spec shared across desktop and container
// only needs to branch on this to skip desktop-only setup in container mode — no spec needs it today.
const isContainer = process.env.VSCODE_CONTAINER === '1';

/** Runs on `debuggerDesktopTest` normally; on `containerTest` when driving the Code Builder container. */
export const debuggerTest = isContainer ? containerTest : debuggerDesktopTest;
