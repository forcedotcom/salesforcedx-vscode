/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig } from '@playwright/test';
import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

const baseConfig = createContainerConfig({ testDir: './specs' });
const chromiumProject = baseConfig.projects?.[0];

export default defineConfig({
  ...baseConfig,
  projects: chromiumProject
    ? [
        {
          ...chromiumProject,
          testMatch: [
            'container/deploySource.container.spec.ts',
            'analyticsTemplates.headless.spec.ts',
            'deleteSource.headless.spec.ts',
            'deployManifest.headless.spec.ts',
            'deployOnSave.headless.spec.ts',
            'deploySourcePath.headless.spec.ts',
            'deploySourcePathCommandPalette.headless.spec.ts',
            'editorWatcher.headless.spec.ts',
            'generateManifest.headless.spec.ts',
            'manifestCommandVisibility.headless.spec.ts',
            'nonTrackingOrgDeployRetrieveManifest.headless.spec.ts',
            'nonTrackingOrgDeployRetrieveOperations.headless.spec.ts',
            'nonTrackingOrgTrackingCommandsHidden.headless.spec.ts',
            'nonTrackingOrgTrackingUIHidden.headless.spec.ts',
            'packageInstall.headless.spec.ts',
            'projectDeployStart.headless.spec.ts',
            'projectInfo.headless.spec.ts',
            'refreshSObjectDefinitions.headless.spec.ts',
            'retrieveInManifest.headless.spec.ts',
            'retrieveSourcePath.headless.spec.ts',
            'retrieveStaleApiVersion.headless.spec.ts',
            'sourceDiff.headless.spec.ts',
            'sourceDiffMultiple.headless.spec.ts',
            'sourceTrackingStatusBar.headless.spec.ts',
            'taggedErrorChannelOutput.headless.spec.ts',
            'viewChangesCommands.headless.spec.ts'
          ]
        }
      ]
    : []
});
