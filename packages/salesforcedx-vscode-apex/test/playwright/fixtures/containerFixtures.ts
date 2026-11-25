/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerTest } from '@salesforce/playwright-vscode-ext';

export const containerTest = createContainerTest();

/*
 * containerTest plus a `workspaceDir` pointing at the HOST side of the fixture bind mount
 * (CB_FIXTURE_HOST_DIR, published by scripts/codeBuilderLocalE2E.ts). The container's opened folder
 * is that bind mount, so a host-side read of `<workspaceDir>/.sfdx/...` sees what the in-container
 * Apex LSP wrote — letting a spec shared with desktop keep its on-disk assertions. Reads only: files
 * the LSP creates are owned by the container's `codebuilder` user, so deletes must go through
 * removePathsInContainer instead. A missing var is an orchestrator wiring bug, so fail loud.
 */
export const containerWorkspaceTest = containerTest.extend<{ workspaceDir: string }>({
  workspaceDir: async ({}, use) => {
    const hostDir = process.env.CB_FIXTURE_HOST_DIR;
    if (!hostDir) {
      throw new Error(
        'CB_FIXTURE_HOST_DIR is not set — the orchestrator (scripts/codeBuilderLocalE2E.ts) must publish ' +
          'the host side of the fixture bind mount for specs that assert on workspace files.'
      );
    }
    await use(hostDir);
  }
});
