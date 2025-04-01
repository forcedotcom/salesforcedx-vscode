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

describe('Aura LSP', async () => {
  let testSetup: TestSetup;

  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'AuraLsp'
  };

  step('Set up the testing environment', async () => {
    utilities.log('AuraLsp - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);

    // Create Aura Component
    await utilities.createAura('aura1');

    // Reload the VSCode window to allow the Aura Component to be indexed by the Aura Language Server
    await utilities.reloadWindow(utilities.Duration.seconds(20));
  });

  step('Verify LSP finished indexing', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);

    // Get output text from the LSP
    const outputViewText = await utilities.getOutputViewText('Aura Language Server');
    expect(outputViewText).to.contain('language server started');
    utilities.log('Output view text');
    utilities.log(outputViewText);
  });

  step('Go to Definition', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Go to Definition`);
    // Get open text editor
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'aura1.cmp');

    // Move cursor to the middle of "simpleNewContact"
    await textEditor.moveCursor(8, 15);

    // Go to definition through F12
    await utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2));

    // Verify 'Go to definition'
    const definition = await textEditor.getCoordinates();
    expect(definition[0]).to.equal(3);
    expect(definition[1]).to.equal(27);
  });

  step('Autocompletion', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Autocompletion`);
    // Get open text editor
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'aura1.cmp');
    await textEditor.typeTextAt(2, 1, '<aura:appl');
    await utilities.pause(utilities.Duration.seconds(1));

    // Verify autocompletion options are present
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
    expect(ariaLabel).to.contain('aura:application');

    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await autocompletionOptions[0].click();
    await textEditor.typeText('>');
    await textEditor.save();
    await utilities.pause(utilities.Duration.seconds(1));
    const line3Text = await textEditor.getTextAtLine(2);
    expect(line3Text).to.include('aura:application');
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
