/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createDesktopConfig } from '@salesforce/playwright-vscode-ext';

// Match web: LSP tests run long; Explorer runs serially (shared VS Code instance per worker).
export default createDesktopConfig({
  workers: 1,
  fullyParallel: false,
  timeout: 360 * 1000
});
