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
 * is that bind mount, so a host-side write lands in the workspace — letting a spec shared with
 * desktop keep its `workspaceDir` file writes. That folder is the version-controlled fixture, so a write
 * should leave it unchanged (or be cleaned up); files the container creates are owned by its
 * `codebuilder` user, so host-side deletes of those fail. A missing var is an orchestrator wiring bug,
 * so fail loud.
 */
export const containerWorkspaceTest = containerTest.extend<{ workspaceDir: string }>({
  workspaceDir: async ({}, use) => {
    const hostDir = process.env.CB_FIXTURE_HOST_DIR;
    if (!hostDir) {
      throw new Error(
        'CB_FIXTURE_HOST_DIR is not set — the orchestrator (scripts/codeBuilderLocalE2E.ts) must publish ' +
          'the host side of the fixture bind mount for specs that write workspace files.'
      );
    }
    await use(hostDir);
  }
});
