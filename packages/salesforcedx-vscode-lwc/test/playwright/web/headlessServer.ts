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
  await fs.mkdir(path.join(dir, 'force-app', 'main', 'default', 'lwc'), { recursive: true });
  await fs.writeFile(path.join(dir, 'lwc.html'), '', 'utf8');
  await fs.writeFile(path.join(dir, 'lwc.js'), '', 'utf8');

  await createHeadlessServer({
    extensionName: 'Lightning Web Components',
    callerDirname: __dirname,
    folderPath: dir
  });
  setupSignalHandlers();
};

void main();
