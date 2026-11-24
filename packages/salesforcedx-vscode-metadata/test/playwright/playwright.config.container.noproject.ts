/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

// Separate from the standard container suite: these specs require the NON-project workspace shape (no
// sfdx-project.json open), which the orchestrator sets up in a distinct phase (re-seed coder.json to the
// container-noproject mount + restart). Keeping them out of playwright.config.container.ts means they
// never run against the DX-project phase (where noProjectCommandsHidden's "commands hidden" assertions
// would fail). The specs are shared with desktop; their container branches assume this shape.
export default createContainerConfig({
  testDir: './specs',
  testMatch: [
    'createProject.desktop.spec.ts',
    'createProjectWithManifest.desktop.spec.ts',
    'noProjectCommandsHidden.headless.spec.ts'
  ]
});
