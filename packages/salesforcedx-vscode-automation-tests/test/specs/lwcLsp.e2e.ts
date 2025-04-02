/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { step } from 'mocha-steps';
import { TestSetup } from 'salesforcedx-vscode-automation-tests-redhat/test/testSetup';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { By, after } from 'vscode-extension-tester';

describe('LWC LSP', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'LwcLsp'
  };

  step('Set up the testing environment', async () => {
    utilities.log('LwcLsp - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);

    // Create Lightning Web Component
    await utilities.createLwc('lwc1');

    // Reload the VSCode window to allow the LWC to be indexed by the LWC Language Server
    await utilities.reloadWindow(utilities.Duration.seconds(20));
  });

  step('Go to Definition (JavaScript)', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Go to Definition (Javascript)`);
    // Get open text editor
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'lwc1.js');

    // Move cursor to the middle of "LightningElement"
    await textEditor.moveCursor(3, 40);

    // Go to definition through F12
    await utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2));

    // Verify 'Go to definition' took us to the definition file
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('engine.d.ts');
  });

  step('Go to Definition (HTML)', async () => {
    if (process.platform !== 'win32') {
      utilities.log(`${testSetup.testSuiteSuffixName} - Go to Definition (HTML)`);
      // Get open text editor
      const workbench = await utilities.getWorkbench();
      const textEditor = await utilities.getTextEditor(workbench, 'lwc1.html');

      // Move cursor to the middle of "greeting"
      await textEditor.moveCursor(3, 58);

      // Go to definition through F12
      await utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2));

      // Verify 'Go to definition' took us to the definition file
      const editorView = workbench.getEditorView();
      const activeTab = await editorView.getActiveTab();
      const title = await activeTab?.getTitle();
      expect(title).to.equal('lwc1.js');
    }
  });

  step('Autocompletion', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Autocompletion`);
    // Get open text editor
    const workbench = await utilities.getWorkbench().wait();
    const textEditor = await utilities.getTextEditor(workbench, 'lwc1.html');
    await textEditor.typeTextAt(5, 1, '<lightnin');
    await utilities.pause(utilities.Duration.seconds(1));

    // Verify autocompletion options are present
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
    expect(ariaLabel).to.contain('lightning-accordion');

    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await autocompletionOptions[0].click();
    await textEditor.typeText('>');
    await textEditor.save();
    await utilities.pause(utilities.Duration.seconds(1));
    const line5Text = await textEditor.getTextAtLine(5);
    expect(line5Text).to.contain('lightning-accordion');
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
