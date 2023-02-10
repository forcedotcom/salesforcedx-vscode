/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  StatusBar,
} from 'wdio-vscode-service';

export async function getStatusBarItemWhichIncludes(statusBar: StatusBar, title: string): Promise<WebdriverIO.Element> {
  const items = await statusBar.item$$;
  for (const item of items) {
    const itemTitle = await item.getAttribute(statusBar.locators.itemTitle);
    if (itemTitle.includes(title)) {
        return item;
    }
  }

  throw new Error(`Status bar item containing ${title} was not found`);
}
