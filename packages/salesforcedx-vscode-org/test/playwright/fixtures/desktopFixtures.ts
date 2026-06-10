/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, MINIMAL_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

/** `sfdx-project.json` workspace, no `.sfdx/config.json` — palette assertions do not need a real org */
export const orgDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core']
});

/** Same workspace with the minimal scratch org set as default (`.sfdx/config.json` target-org),
 * so default-org context keys (e.g. `sf:default_org_deletable`) are populated. */
export const orgDesktopMinimalDefaultTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  orgAlias: MINIMAL_ORG_ALIAS
});
