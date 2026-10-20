/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { containerTest, containerWorkspaceTest } from './containerFixtures';
import { desktopTest } from './desktopFixtures';

export const isContainer = process.env.VSCODE_CONTAINER === '1';
export const sharedTest = isContainer ? containerTest : desktopTest;

/**
 * Like `sharedTest`, but both sides provide `workspaceDir`: desktop's temp workspace, or the host side
 * of the container's fixture bind mount. For shared specs that write workspace files.
 */
export const sharedWorkspaceDirTest = isContainer ? containerWorkspaceTest : desktopTest;
