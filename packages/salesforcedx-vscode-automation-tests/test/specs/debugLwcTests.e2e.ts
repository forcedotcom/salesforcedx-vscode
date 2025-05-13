/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  TestReqConfig,
  ProjectShapeOption,
  Duration,
  log,
  pause
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { createLwc } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { installJestUTToolsForLwc } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import {
  getTestsSection,
  verifyTestItemsInSideBar,
  continueDebugging,
  verifyTestIconColor
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  closeAllEditors,
  reloadWindow,
  getWorkbench,
  executeQuickPick,
  getTerminalViewText,
  verifyOutputPanelText,
  runCommandFromCommandPrompt,
  getTextEditor
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { fail } from 'node:assert';
import * as path from 'node:path';
import { SideBarView, TreeItem, after } from 'vscode-extension-tester';

describe('Debug LWC Tests', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'DebugLWCTests'
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);

    // Close both Welcome and Running Extensions tabs
    await closeAllEditors();

    // Create LWC1 and test
    await createLwc('lwc1');

    // Create LWC2 and test
    await createLwc('lwc2');

    // Install Jest unit testing tools for LWC
    await installJestUTToolsForLwc(testSetup.projectFolderPath);
    await reloadWindow(Duration.seconds(30));
  });

  it('Debug All Tests on a LWC via the Test Sidebar', async () => {
    log(`${testSetup.testSuiteSuffixName} - Debug All tests on a LWC via the Test Sidebar`);
    const workbench = getWorkbench();
    await executeQuickPick('Testing: Focus on LWC Tests View', Duration.seconds(3));

    // Open the Test Sidebar
    const lwcTestsSection = await getTestsSection(workbench, 'LWC Tests');
    const expectedItems = ['lwc1', 'lwc2', 'displays greeting', 'is defined'];
    const lwcTestsItems = await verifyTestItemsInSideBar(
      lwcTestsSection,
      'SFDX: Refresh Lightning Web Component Test Explorer',
      expectedItems,
      6,
      2
    );

    // Click the debug test button that is shown to the right when you hover a test class name on the Test sidebar
    await lwcTestsItems[0].select();
    const debugTestsAction = await lwcTestsItems[0].getActionButton('SFDX: Debug Lightning Web Component Test File');
    expect(debugTestsAction).to.not.be.undefined;
    await debugTestsAction!.click();
    await pause(Duration.seconds(15));

    // Continue with the debug session
    await continueDebugging(2);

    // Verify test results are listed on the terminal
    // Also verify that all tests pass
    const terminalText = await getTerminalViewText(workbench, 10);
    const expectedTexts = [
      'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'Test Suites: 1 passed, 1 total',
      'Tests:       2 passed, 2 total',
      'Snapshots:   0 total',
      'Ran all test suites within paths',
      `${path.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    await executeQuickPick('Testing: Focus on LWC Tests View', Duration.seconds(3));
    await verifyTestIconColor(lwcTestsItems[0], 'testPass');
  });

  it('Debug Single Test via the Test Sidebar', async () => {
    log(`${testSetup.testSuiteSuffixName} - Debug Single Test via the Test Sidebar`);
    const workbench = getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');
    expect(testingView).to.not.be.undefined;
    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).to.be.instanceOf(SideBarView);

    // Hover a test name under one of the test lwc sections and click the debug button that is shown to the right of the test name on the Test sidebar
    const lwcTestsSection = await getTestsSection(workbench, 'LWC Tests');
    const lwcTestItem = (await lwcTestsSection.findItem('displays greeting')) as TreeItem;
    await lwcTestItem.select();
    const debugTestAction = await lwcTestItem.getActionButton('SFDX: Debug Lightning Web Component Test Case');
    expect(debugTestAction).to.not.be.undefined;
    await debugTestAction!.click();
    await pause(Duration.seconds(15));

    // Continue with the debug session
    await continueDebugging(1);

    // Verify test results are listed on the terminal
    // Also verify that all tests pass
    const terminalText = await getTerminalViewText(workbench, 10);
    const expectedTexts = [
      'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'Test Suites: 1 passed, 1 total',
      'Tests:       1 skipped, 1 passed, 2 total',
      'Snapshots:   0 total',
      'Ran all test suites within paths',
      `${path.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    await runCommandFromCommandPrompt(workbench, 'Testing: Focus on LWC Tests View', Duration.seconds(3));
    await verifyTestIconColor(lwcTestItem, 'testPass');
  });

  it('SFDX: Debug Current Lightning Web Component Test File from Command Palette', async () => {
    log(
      `${testSetup.testSuiteSuffixName} - SFDX: Debug Current Lightning Web Component Test File from Command Palette`
    );

    // Debug SFDX: Debug Current Lightning Web Component Test File
    const workbench = getWorkbench();
    await executeQuickPick('SFDX: Debug Current Lightning Web Component Test File', Duration.seconds(15));

    // Continue with the debug session
    await continueDebugging(2);

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const terminalText = await getTerminalViewText(workbench, 10);
    const expectedTexts = [
      'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'Test Suites: 1 passed, 1 total',
      'Tests:       2 passed, 2 total',
      'Snapshots:   0 total',
      'Ran all test suites within paths',
      `${path.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  it('Debug All Tests via Code Lens action', async () => {
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc1.test.js');

    // Click the "Debug" code lens at the top of the class
    const debugAllTestsOption = await textEditor.getCodeLens('Debug');
    if (!debugAllTestsOption) {
      fail('Could not find debug all tests action button');
    }
    await debugAllTestsOption.click();
    await pause(Duration.seconds(15));

    // Continue with the debug session
    await continueDebugging(2);

    // Verify test results are listed on the terminal
    // Also verify that all tests pass
    const terminalText = await getTerminalViewText(workbench, 10);
    const expectedTexts = [
      'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'Test Suites: 1 passed, 1 total',
      'Tests:       2 passed, 2 total',
      'Snapshots:   0 total',
      'Ran all test suites within paths',
      `${path.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  it('Debug Single Test via Code Lens action', async () => {
    log(`${testSetup.testSuiteSuffixName} - Debug Single Test via Code Lens action`);

    // Click the "Debug Test" code lens at the top of one of the test methods
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc2.test.js');
    const debugTestOption = await textEditor.getCodeLens('Debug Test');
    if (!debugTestOption) {
      fail('Could not find debug test action button');
    }
    await debugTestOption.click();
    await pause(Duration.seconds(15));

    // Continue with the debug session
    await continueDebugging(1);

    // Verify test results are listed on the terminal
    // Also verify that all tests pass
    const terminalText = await getTerminalViewText(workbench, 10);
    const expectedTexts = [
      'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
      'Test Suites: 1 passed, 1 total',
      'Tests:       1 skipped, 1 passed, 2 total',
      'Snapshots:   0 total',
      'Ran all test suites within paths',
      `${path.join('force-app', 'main', 'default', 'lwc', 'lwc2', '__tests__', 'lwc2.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  it('SFDX: Debug Current Lightning Web Component Test File from main toolbar', async () => {
    log(`${testSetup.testSuiteSuffixName} - SFDX: Debug Current Lightning Web Component Test File from main toolbar`);

    // Debug SFDX: Debug Current Lightning Web Component Test File
    const workbench = getWorkbench();
    const editorView = workbench.getEditorView();
    const debugTestButtonToolbar = await editorView.getAction('SFDX: Debug Current Lightning Web Component Test File');
    expect(debugTestButtonToolbar).to.not.be.undefined;
    await debugTestButtonToolbar?.click();
    await pause(Duration.seconds(15));

    // Continue with the debug session
    await continueDebugging(2);

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const terminalText = await getTerminalViewText(workbench, 10);
    const expectedTexts = [
      'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
      'Test Suites: 1 passed, 1 total',
      'Tests:       2 passed, 2 total',
      'Snapshots:   0 total',
      'Ran all test suites within paths',
      `${path.join('force-app', 'main', 'default', 'lwc', 'lwc2', '__tests__', 'lwc2.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
