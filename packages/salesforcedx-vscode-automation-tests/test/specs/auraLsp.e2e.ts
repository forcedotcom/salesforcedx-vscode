/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Duration, ProjectShapeOption, TestReqConfig } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { log, openFile, pause } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core/miscellaneous';
import { retryOperation } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import { createAura } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  executeQuickPick,
  getStatusBarItemWhichIncludes,
  getTextEditor,
  getWorkbench,
  moveCursorWithFallback,
  reloadWindow
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { By, after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { getFolderPath } from '../utils/buildFilePathHelper';
import { logTestStart } from '../utils/loggingHelper';

describe('Aura LSP', () => {
  let testSetup: TestSetup;
  let auraFolderPath: string;

  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'AuraLsp',
    extensionConfigs: [
      ...defaultExtensionConfigs,
      {
        extensionId: 'salesforcedx-vscode-lightning',
        shouldVerifyActivation: false, // We don't activate until we have an Aura Component
        shouldInstall: 'always'
      }
    ]
  };

  before('Set up the testing environment', async () => {
    log('AuraLsp - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    auraFolderPath = getFolderPath(testSetup.projectFolderPath!, 'aura');

    // Create Aura Component
    await retryOperation(() => createAura('aura1', auraFolderPath), 2, 'AuraLsp - Error creating Aura Component');

    // Reload the VSCode window to allow the Aura Component to be indexed by the Aura Language Server
    await reloadWindow(Duration.seconds(20));
  });

  it('Verify Aura LSP finished indexing in status bar', async () => {
    logTestStart(testSetup, 'Verify Aura LSP finished indexing in status bar');

    await retryOperation(
      async () => {
        await openFile(path.join(auraFolderPath, 'aura1.cmp'));

        const statusBar = await getStatusBarItemWhichIncludes('Editor Language Status');
        await statusBar.click();
        expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
      },
      5,
      'Aura language status did not reach indexing complete'
    );
  });

  it('Go to Definition', async () => {
    logTestStart(testSetup, 'Go to Definition');
    // Get open text editor
    await openFile(path.join(auraFolderPath, 'aura1.cmp'));
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'aura1.cmp');

    // Move cursor to the middle of "simpleNewContact"
    await moveCursorWithFallback(textEditor, 8, 15);

    // Go to definition through F12
    await executeQuickPick('Go to Definition', Duration.seconds(2));

    // Verify 'Go to definition'
    const definition = await textEditor.getCoordinates();
    expect(definition[0]).to.equal(3);
    expect(definition[1]).to.equal(27);
  });

  it('Autocompletion', async () => {
    logTestStart(testSetup, 'Autocompletion');
    // Get open text editor
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'aura1.cmp');
    await textEditor.typeTextAt(2, 1, '<aura:appl');
    await pause(Duration.seconds(1));

    // Verify autocompletion options are present
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
    expect(ariaLabel).to.contain('aura:application');

    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await autocompletionOptions[0].click();
    await textEditor.typeText('>');
    await textEditor.save();
    await pause(Duration.seconds(1));
    const line3Text = await textEditor.getTextAtLine(2);
    expect(line3Text).to.include('aura:application');
  });

  after('Tear down and clean up the testing environment', async () => {
    log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
