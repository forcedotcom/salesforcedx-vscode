/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Duration,
  pause,
  TestReqConfig,
  ProjectShapeOption,
  log
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { createAnonymousApexFile } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { createGlobalSnippetsFile } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  getWorkbench,
  getTextEditor,
  executeQuickPick
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { By, after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { logTestStart } from '../utils/loggingHelper';

describe('Miscellaneous', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'Miscellaneous',
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  it.skip('Use out-of-the-box Apex Snippets', async () => {
    logTestStart(testSetup, 'Use Apex Snippets');
    const workbench = await getWorkbench();
    const apexSnippet = 'String.isBlank(inputString)';

    // Create anonymous apex file
    await createAnonymousApexFile();

    // Type snippet "isb" in a new line and check it inserted the expected string
    const textEditor = await getTextEditor(workbench, 'Anonymous.apex');
    const inputBox = await executeQuickPick('Snippets: Insert Snippet', Duration.seconds(1));
    await inputBox.setText('isb');
    await pause(Duration.seconds(1));
    await inputBox.confirm();
    await textEditor.save();
    const fileContent = await textEditor.getText();
    await expect(fileContent).to.contain(apexSnippet);
  });

  it.skip('Use Custom Apex Snippets', async () => {
    logTestStart(testSetup, 'Use Apex Snippets');

    // Using the Command palette, run Snippets: Configure Snippets
    const workbench = await getWorkbench();
    await createGlobalSnippetsFile(testSetup);

    // Create anonymous apex file
    await createAnonymousApexFile();

    // Type snippet "soql" and check it inserted the expected query
    const textEditor = await getTextEditor(workbench, 'Anonymous.apex');
    await textEditor.typeText('soql');
    await pause(Duration.seconds(1));
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
    expect(ariaLabel).to.contain('soql');

    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await autocompletionOptions[0].click();
    await textEditor.save();
    const fileContent = await textEditor.getText();
    expect(fileContent).to.contain('[SELECT field1, field2 FROM SobjectName WHERE clause];');
  });

  it.skip('Use out-of-the-box LWC Snippets - HTML', async () => {
    logTestStart(testSetup, 'Use out-of-the-box LWC Snippets - HTML');
    const workbench = await getWorkbench();

    const lwcSnippet = [
      '<lightning-button',
      '  variant="base"',
      '  label="Button Label"',
      '  onclick={handleClick}',
      '></lightning-button>'
    ].join('\n');

    // Create simple lwc.html file
    let inputBox = await executeQuickPick('Create: New File...', Duration.seconds(1));
    await inputBox.setText('lwc.html');
    await inputBox.confirm();
    await inputBox.confirm();

    // Type snippet "lwc-button" and check it inserted the right lwc
    const textEditor = await getTextEditor(workbench, 'lwc.html');

    inputBox = await executeQuickPick('Snippets: Insert Snippet', Duration.seconds(1));
    await inputBox.setText('lwc-button');
    await pause(Duration.seconds(2));
    await inputBox.confirm();
    await textEditor.save();
    const fileContent = await textEditor.getText();

    const fileContentWithoutTrailingSpaces = fileContent
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');

    await expect(fileContentWithoutTrailingSpaces).to.contain(lwcSnippet);
  });

  it('Use out-of-the-box LWC Snippets - JS', async () => {
    logTestStart(testSetup, 'Use out-of-the-box LWC Snippets - JS');
    const workbench = await getWorkbench();

    const lwcSnippet = 'this.dispatchEvent(new CustomEvent("event-name"));';

    // Create simple lwc.js file
    const inputBox = await executeQuickPick('Create: New File...', Duration.seconds(1));
    await inputBox.setText('lwc.js');
    await inputBox.confirm();
    await inputBox.confirm();

    // Type snippet "lwc", select "lwc-event" and check it inserted the right thing
    const textEditor = await getTextEditor(workbench, 'lwc.js');
    await textEditor.typeText('lwc');
    await pause(Duration.seconds(1));
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
    log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
