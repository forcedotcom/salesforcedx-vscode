/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { createHeadlessServer, createTestWorkspace, setupSignalHandlers } from '@salesforce/playwright-vscode-ext';

const main = async (): Promise<void> => {
  const dir = await createTestWorkspace(undefined);
  const anonymousApexDir = path.join(dir, 'scripts', 'apex');
  await fs.mkdir(anonymousApexDir, { recursive: true });
  await fs.writeFile(path.join(anonymousApexDir, 'Anonymous.apex'), '// anonymous apex\n', 'utf8');

  await createHeadlessServer({
    extensionName: 'Apex',
    callerDirname: __dirname,
    folderPath: dir,
    additionalExtensionDirs: ['salesforcedx-vscode-core']
  });
  setupSignalHandlers();
};

void main();
