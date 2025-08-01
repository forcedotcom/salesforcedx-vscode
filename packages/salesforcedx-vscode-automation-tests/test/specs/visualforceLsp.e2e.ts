/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Duration,
  log,
  pause,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import {
  createApexController,
  createVisualforcePage
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import { clearOutputView, executeQuickPick, getTextEditor, getWorkbench, moveCursorWithFallback } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { By, after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { logTestStart } from '../utils/loggingHelper';

describe('Visualforce LSP', () => {
  let testSetup: TestSetup;
  let classesFolderPath: string;
  let pagesFolderPath: string;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'VisualforceLsp',
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    log('VisualforceLsp - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    classesFolderPath = path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes');
    pagesFolderPath = path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'pages');

    // Create Apex controller for the Visualforce Page
    await createApexController(classesFolderPath);

    // Clear output before running the command
    await clearOutputView();
    log(`${testSetup.testSuiteSuffixName} - calling createVisualforcePage()`);
    await createVisualforcePage(pagesFolderPath);
  });

  it.skip('Go to Definition', async () => {
    logTestStart(testSetup, 'Go to Definition');
    // Get open text editor
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'FooPage.page');
    await moveCursorWithFallback(textEditor, 1, 25);

    // Go to definition through F12
    await executeQuickPick('Go to Definition', Duration.seconds(2));
    await pause(Duration.seconds(1));

    // TODO: go to definition is actually not working

    // // Verify 'Go to definition' took us to the definition file
    // const activeTab = await editorView.getActiveTab();
    // const title = await activeTab?.getTitle();
    // expect(title).toBe('MyController.cls');
  });

  it('Autocompletion', async () => {
    logTestStart(testSetup, 'Autocompletion');
    // Get open text editor
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'FooPage.page');
    await textEditor.typeTextAt(3, 1, '\t\t<apex:pageM');
    await pause(Duration.seconds(1));

    // Verify autocompletion options are present
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
    expect(ariaLabel).to.contain('apex:pageMessage');

    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await autocompletionOptions[0].click();
    await textEditor.typeText('/>');
    await textEditor.save();
    await pause(Duration.seconds(1));
    const line3Text = await textEditor.getTextAtLine(3);
    expect(line3Text).to.contain('apex:pageMessage');
  });

  after('Tear down and clean up the testing environment', async () => {
    log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
