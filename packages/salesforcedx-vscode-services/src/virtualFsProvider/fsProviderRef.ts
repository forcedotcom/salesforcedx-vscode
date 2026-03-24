/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FsProvider } from './fsTypes';

/** Set by fileSystemSetup on web. FsService.findFiles uses this when ESBUILD_PLATFORM === 'web' (workspace.findFiles is desktop-only). */
export const fsProviderRef: { current: FsProvider | undefined } = { current: undefined };
