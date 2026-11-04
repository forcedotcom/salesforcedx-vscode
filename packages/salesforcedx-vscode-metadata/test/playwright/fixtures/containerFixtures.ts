/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CONTAINER_USER,
  createContainerTest,
  defaultRunner,
  removePathsInContainer
} from '@salesforce/playwright-vscode-ext';
import * as path from 'node:path';
import type { ProjectTarget } from './projectTarget';

export const containerTest = createContainerTest();

/**
 * containerTest plus `workspaceDir`: the host side of the fixture bind mount, published by the
 * orchestrator (scripts/codeBuilderLocalE2E.ts). A host-side node:fs write there lands in the folder
 * code-server has open. A missing var is a wiring bug, so fail loud rather than write to a guessed path.
 */
export const containerWorkspaceTest = containerTest.extend<{ workspaceDir: string }>({
  workspaceDir: async ({}, use) => {
    const hostDir = process.env.CB_FIXTURE_HOST_DIR;
    if (!hostDir) {
      throw new Error(
        'CB_FIXTURE_HOST_DIR is not set — the orchestrator (scripts/codeBuilderLocalE2E.ts) must publish the ' +
          'host side of the fixture bind mount so specs can write files into the opened workspace.'
      );
    }
    await use(hostDir);
  }
});

/** code-server's record of the last-opened folder; `/` redirects there. The orchestrator seeds it per phase. */
const CODER_JSON = '/home/codebuilder/.local/share/code-server/coder.json';

/**
 * containerTest plus a `projectTarget` in the no-project mount's checked-in `scratch/` subfolder. The
 * file dialog browses the container's filesystem whatever workspace is (or isn't) open, so Create
 * Project specs can scaffold there; the orchestrator (scripts/codeBuilderLocalE2E.ts) publishes the
 * container name and both sides of that mount.
 *
 * Create Project ends with `vscode.openFolder`, which makes code-server record the new project as the
 * last-opened folder. The next test's `page.goto('/')` would then reopen it — already deleted by then,
 * so a "Workspace does not exist" modal blocks the workbench. Teardown restores the phase's seeded
 * coder.json so `/` lands back on the seeded shape.
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
    const seededCoderJson = defaultRunner('docker', ['exec', '-u', CONTAINER_USER, containerName, 'cat', CODER_JSON]);
    await use({
      dialogDir: scratchContainerDir,
      dialogSep: '/',
      hostDir: path.join(hostDir, 'scratch'),
      removeProject: projectName =>
        removePathsInContainer(containerName, [path.posix.join(scratchContainerDir, projectName)])
    });
    defaultRunner('docker', [
      'exec',
      '-u',
      CONTAINER_USER,
      containerName,
      'sh',
      '-c',
      'printf "%s" "$1" > "$2"',
      'sh',
      seededCoderJson,
      CODER_JSON
    ]);
  }
});
