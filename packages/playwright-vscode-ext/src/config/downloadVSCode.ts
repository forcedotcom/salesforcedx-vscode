/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import * as path from 'node:path';
import { resolveRepoRoot } from '../utils/repoRoot';

/**
 * Global setup function that downloads VS Code before tests run.
 * This prevents simultaneous downloads when multiple workers start.
 */
export default async (): Promise<void> => {
  const repoRoot = resolveRepoRoot(__dirname);
  const cachePath = path.join(repoRoot, '.vscode-test');
  const version = process.env.PLAYWRIGHT_DESKTOP_VSCODE_VERSION ?? undefined;
  await downloadAndUnzipVSCode({ version, cachePath });
};
