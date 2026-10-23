/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerTest, removePathsInContainer } from '@salesforce/playwright-vscode-ext';
import * as path from 'node:path';
import type { ProjectTarget } from './projectTarget';

export const containerTest = createContainerTest();

/**
 * containerTest plus a `projectTarget` in the no-project mount's checked-in `scratch/` subfolder. The
 * file dialog browses the container's filesystem whatever workspace is (or isn't) open, so Create
 * Project specs can scaffold there; the orchestrator (scripts/codeBuilderLocalE2E.ts) publishes the
 * container name and both sides of that mount.
 */
export const projectTargetContainerTest = containerTest.extend<{ projectTarget: ProjectTarget }>({
  projectTarget: async ({}, use) => {
    const containerName = process.env.CB_CONTAINER_NAME;
    const containerDir = process.env.CB_NOPROJECT_CONTAINER_DIR;
    const hostDir = process.env.CB_NOPROJECT_HOST_DIR;
    if (!containerName || !containerDir || !hostDir) {
      throw new Error(
        'CB_CONTAINER_NAME / CB_NOPROJECT_CONTAINER_DIR / CB_NOPROJECT_HOST_DIR is not set — the ' +
          'orchestrator (scripts/codeBuilderLocalE2E.ts) must publish these so Create Project specs can ' +
          "target the no-project mount's scratch/ subfolder and clean up what they scaffold there."
      );
    }
    const scratchContainerDir = path.posix.join(containerDir, 'scratch');
    await use({
      dialogDir: scratchContainerDir,
      dialogSep: '/',
      hostDir: path.join(hostDir, 'scratch'),
      removeProject: projectName =>
        removePathsInContainer(containerName, [path.posix.join(scratchContainerDir, projectName)])
    });
  }
});
