/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Duration,
  pause,
  log,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { retryOperation } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import { createLwc } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  executeQuickPick,
  getWorkbench,
  getTextEditor,
  reloadWindow,
  moveCursorWithFallback
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { By, after } from 'vscode-extension-tester';
import { logTestStart } from '../utils/loggingHelper';

describe('LWC LSP', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'LwcLsp'
  };

  before('Set up the testing environment', async () => {
    log('LwcLsp - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);

    // Create Lightning Web Component
    await createLwc('lwc1', path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'lwc'));

    // Reload the VSCode window to allow the LWC to be indexed by the LWC Language Server
    await reloadWindow(Duration.seconds(20));
  });

  beforeEach(function () {
    if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
      this.skip();
    }
  });

  it('Go to Definition (JavaScript)', async () => {
    logTestStart(testSetup, 'Go to Definition (Javascript)');
    // Get open text editor
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc1.js');

    // Move cursor to the middle of "LightningElement"
    await moveCursorWithFallback(textEditor, 3, 40);

    // Go to definition through F12
    await executeQuickPick('Go to Definition', Duration.seconds(2));

    // Verify 'Go to definition' took us to the definition file
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('engine.d.ts');
  });

  it('Go to Definition (HTML)', async () => {
    if (process.platform !== 'win32') {
      logTestStart(testSetup, 'Go to Definition (HTML)');
      const workbench = getWorkbench();
      await retryOperation(async () => {
        const textEditor = await getTextEditor(workbench, 'lwc1.html');
        log(`*** current tab = ${await textEditor.getTitle()}`);
        await pause(Duration.seconds(2));
        await moveCursorWithFallback(textEditor, 3, 58);

        // Allow time for LSP to process cursor movement and prepare definition lookup
        await pause(Duration.seconds(2));
        // Go to definition through F12
        await executeQuickPick('Go to Definition', Duration.seconds(3));

        // Verify 'Go to definition' took us to the definition file
        await executeQuickPick('View: Focus Active Editor Group', Duration.seconds(1));
        const editorView = workbench.getEditorView();
        const activeTab = await editorView.getActiveTab();
        const title = await activeTab?.getTitle();
        expect(title).to.equal('lwc1.js');
      }, 3, 'Go to Definition (HTML) - Error switching to lwc1.js');
    }
  });

  it('Autocompletion', async () => {
    logTestStart(testSetup, 'Autocompletion');
    // Get open text editor
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc1.html');
    await textEditor.typeTextAt(5, 1, '<lightnin');
    await pause(Duration.seconds(1));

    // Verify autocompletion options are present
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
    expect(ariaLabel).to.contain('lightning-accordion');

    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await autocompletionOptions[0].click();
    await textEditor.typeText('>');
    await textEditor.save();
    await pause(Duration.seconds(1));
    const line5Text = await textEditor.getTextAtLine(5);
    expect(line5Text).to.contain('lightning-accordion');
  });

  after('Tear down and clean up the testing environment', async () => {
    log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
