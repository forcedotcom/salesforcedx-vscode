/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is Node.js test infrastructure, not extension code
import { test as base, type Page } from '@playwright/test';
import { waitForVSCodeWorkbench } from '../utils/helpers';

/**
 * Playwright test for driving a running Code Builder container.
 *
 * The `page` fixture is a plain Chromium page (from the config's browser) navigated to the
 * container's workbench URL — the same browser-client model as web mode, but the workbench runs the
 * desktop extension build in a Node host. Container lifecycle (run, extension-swap, restart,
 * health-check) is owned by the workflow, not this fixture. The fixture only lands the page on a
 * ready workbench, so specs reuse the existing plain-`Page` page objects unchanged.
 *
 * `VSCODE_DESKTOP` is deliberately NOT set — `waitForVSCodeWorkbench` takes its web branch
 * (navigate to `/`, then wait for `.monaco-workbench`), which is correct for a browser-served editor.
 */
export const createContainerTest = () =>
  base.extend<{ page: Page }>({
    page: async ({ page }, use) => {
      await waitForVSCodeWorkbench(page);
      await use(page);
    }
  });
