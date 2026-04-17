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
  const bundleDir = path.join(dir, 'force-app', 'main', 'default', 'lwc', 'snippetsE2E');
  await fs.mkdir(bundleDir, { recursive: true });
  await fs.writeFile(path.join(bundleDir, 'snippetsE2E.html'), '', 'utf8');
  await fs.writeFile(path.join(bundleDir, 'snippetsE2E.js'), '', 'utf8');

  await createHeadlessServer({
    extensionName: 'Lightning Web Components',
    callerDirname: __dirname,
    folderPath: dir
  });
  setupSignalHandlers();
};

void main();
