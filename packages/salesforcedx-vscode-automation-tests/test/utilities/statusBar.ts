/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WebElement } from 'vscode-extension-tester';
import { Duration, log, pause } from './miscellaneous';
import { getWorkbench } from './workbench';

export async function getStatusBarItemWhichIncludes(title: string): Promise<WebElement> {
  const workbench = getWorkbench();
  const retries = 10;
  for (let i = retries; i > 0; i--) {
    const statusBar = await workbench.getStatusBar().wait();
    const items = await statusBar.getItems();
    for (const item of items) {
      const ariaLabel = await item.getAttribute('aria-label');
      if (ariaLabel.includes(title)) {
        log('Status Bar item found.');
        return item;
      }
    }
    await pause(Duration.seconds(1));
  }
  throw new Error(`Status bar item containing ${title} was not found`);
}
