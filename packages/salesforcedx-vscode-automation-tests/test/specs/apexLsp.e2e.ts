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
import { EnvironmentSettings } from '../environmentSettings';

describe('Apex LSP', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'ApexLsp'
  };

  step('Set up the testing environment', async () => {
    utilities.log('ApexLsp - Set up the testing environment');
    utilities.log(`ApexLsp - JAVA_HOME: ${EnvironmentSettings.getInstance().javaHome}`);
    testSetup = await TestSetup.setUp(testReqConfig);
    await utilities.pause(utilities.Duration.seconds(10));
    // Create Apex Class
    await utilities.createApexClassWithTest('ExampleClass');
  });

  step('Verify LSP finished indexing', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);
    // Go to apex class file
    const workbench = await utilities.getWorkbench();
    await utilities.getTextEditor(workbench, 'ExampleClass.cls');
    // Get Apex LSP Status Bar
    const statusBar = await utilities.getStatusBarItemWhichIncludes('Editor Language Status');
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.include('Indexing complete');

    // Get output text from the LSP
    const outputViewText = await utilities.getOutputViewText('Apex Language Server');
    utilities.log('Output view text');
    utilities.log(outputViewText);
  });

  step('Go to Definition', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Go to Definition`);
    // Get open text editor
    const workbench = utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'ExampleClassTest.cls');
    // Move cursor to the middle of "ExampleClass.SayHello() call"
    await textEditor.moveCursor(6, 20);
    await utilities.pause(utilities.Duration.seconds(1));

    // Go to definition through F12
    await utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2));

    // Verify 'Go to definition' took us to the definition file
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('ExampleClass.cls');
  });

  step('Autocompletion', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Autocompletion`);
    // Get open text editor
    const workbench = await utilities.getWorkbench().wait();
    const textEditor = await utilities.getTextEditor(workbench, 'ExampleClassTest.cls');

    // Move cursor to line 7 and type ExampleClass.say
    await textEditor.typeTextAt(7, 1, '\tExampleClass.say');
    await utilities.pause(utilities.Duration.seconds(1));

    // Verify autocompletion options are present
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
    expect(ariaLabel).to.contain('SayHello(name)');
    await autocompletionOptions[0].click();
    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await textEditor.typeText("'Jack");
    await textEditor.typeTextAt(7, 38, ';');
    await textEditor.save();
    await utilities.pause(utilities.Duration.seconds(1));
    const line7Text = await textEditor.getTextAtLine(7);
    expect(line7Text).to.include("ExampleClass.SayHello('Jack');");
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
