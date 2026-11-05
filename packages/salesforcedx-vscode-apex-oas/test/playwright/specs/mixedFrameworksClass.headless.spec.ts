/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { oasDesktopTest as test } from '../fixtures/desktopFixtures';
import { expect } from '@playwright/test';
import { createApexClass, executeCommandWithCommandPalette, openFileByName } from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import { mixedFrameworksClassText } from '../testData/sampleClassData';
import {
  confirmEsrFolderPrompt,
  pushSource,
  setupWorkbenchAndAuth,
  waitForEsrFile,
  waitForOasCommands
} from '../utils/oasHelpers';

test.setTimeout(360_000);

test('OAS: class mixing Apex REST and AuraEnabled generates an Aura ESR', async ({ page, workspaceDir }) => {
  await test.step('setup workbench + auth', async () => {
    await setupWorkbenchAndAuth(page);
  });

  await test.step('wait for OAS commands available', async () => {
    await waitForOasCommands(page);
  });

  await test.step('create mixed-frameworks class and push', async () => {
    await createApexClass(page, 'MixedFrameworksClass', mixedFrameworksClassText);
    await pushSource(page);
  });

  await test.step('generate an Aura OAS document', async () => {
    await openFileByName(page, 'MixedFrameworksClass.cls');
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');
    await confirmEsrFolderPrompt(page);
    const esrPath = await waitForEsrFile(workspaceDir, 'MixedFrameworksClass');
    const esr = await fs.readFile(esrPath, 'utf8');
    expect(esr).toContain('<registrationProviderAsset>MixedFrameworksClass</registrationProviderAsset>');
    expect(esr).toContain('<registrationProviderType>AuraEnabled</registrationProviderType>');
    expect(esr).toContain('getAccountForAura');
    expect(esr).not.toContain('operationId: getAccount\n');
  });
});
