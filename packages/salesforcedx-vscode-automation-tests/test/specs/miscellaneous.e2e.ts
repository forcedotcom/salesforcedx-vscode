/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step, xstep } from 'mocha-steps';
import { TestSetup } from 'salesforcedx-vscode-automation-tests-redhat/test/testSetup';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { expect } from 'chai';
import { By, after } from 'vscode-extension-tester';

describe('Miscellaneous', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'Miscellaneous'
  };

  step('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  xstep('Use out-of-the-box Apex Snippets', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Use Apex Snippets`);
    const workbench = await utilities.getWorkbench();
    const apexSnippet = 'String.isBlank(inputString)';

    // Create anonymous apex file
    await utilities.createAnonymousApexFile();

    // Type snippet "isb" in a new line and check it inserted the expected string
    const textEditor = await utilities.getTextEditor(workbench, 'Anonymous.apex');
    const inputBox = await utilities.executeQuickPick('Snippets: Insert Snippet', utilities.Duration.seconds(1));
    await inputBox.setText('isb');
    await utilities.pause(utilities.Duration.seconds(1));
    await inputBox.confirm();
    await textEditor.save();
    const fileContent = await textEditor.getText();
    await expect(fileContent).to.contain(apexSnippet);
  });

  step('Use Custom Apex Snippets', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Use Apex Snippets`);

    // Using the Command palette, run Snippets: Configure Snippets
    const workbench = await utilities.getWorkbench();
    await utilities.createGlobalSnippetsFile(testSetup);

    // Create anonymous apex file
    await utilities.createAnonymousApexFile();

    // Type snippet "soql" and check it inserted the expected query
    const textEditor = await utilities.getTextEditor(workbench, 'Anonymous.apex');
    await textEditor.typeText('soql');
    await utilities.pause(utilities.Duration.seconds(1));
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
    expect(ariaLabel).to.contain('soql');

    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await autocompletionOptions[0].click();
    await textEditor.save();
    const fileContent = await textEditor.getText();
    expect(fileContent).to.contain('[SELECT field1, field2 FROM SobjectName WHERE clause];');
  });

  step('Use out-of-the-box LWC Snippets - HTML', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Use out-of-the-box LWC Snippets - HTML`);
    const workbench = await utilities.getWorkbench();

    const lwcSnippet = [
      '<lightning-button',
      '  variant="base"',
      '  label="Button Label"',
      '  onclick={handleClick}',
      '></lightning-button>'
    ].join('\n');

    // Create simple lwc.html file
    let inputBox = await utilities.executeQuickPick('Create: New File...', utilities.Duration.seconds(1));
    await inputBox.setText('lwc.html');
    await inputBox.confirm();
    await inputBox.confirm();

    // Type snippet "lwc-button" and check it inserted the right lwc
    const textEditor = await utilities.getTextEditor(workbench, 'lwc.html');

    inputBox = await utilities.executeQuickPick('Snippets: Insert Snippet', utilities.Duration.seconds(1));
    await inputBox.setText('lwc-button');
    await utilities.pause(utilities.Duration.seconds(2));
    await inputBox.confirm();
    await textEditor.save();
    const fileContent = await textEditor.getText();

    const fileContentWithoutTrailingSpaces = fileContent
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');

    await expect(fileContentWithoutTrailingSpaces).to.contain(lwcSnippet);
  });

  step('Use out-of-the-box LWC Snippets - JS', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Use out-of-the-box LWC Snippets - JS`);
    const workbench = await utilities.getWorkbench();

    const lwcSnippet = 'this.dispatchEvent(new CustomEvent("event-name"));';

    // Create simple lwc.js file
    const inputBox = await utilities.executeQuickPick('Create: New File...', utilities.Duration.seconds(1));
    await inputBox.setText('lwc.js');
    await inputBox.confirm();
    await inputBox.confirm();

    // Type snippet "lwc", select "lwc-event" and check it inserted the right thing
    const textEditor = await utilities.getTextEditor(workbench, 'lwc.js');
    await textEditor.typeText('lwc');
    await utilities.pause(utilities.Duration.seconds(1));
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[2].getAttribute('aria-label');
    expect(ariaLabel).to.contain('lwc-event');

    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await autocompletionOptions[2].click();
    await textEditor.save();
    const fileContent = await textEditor.getText();

    await expect(fileContent).to.contain(lwcSnippet);
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
