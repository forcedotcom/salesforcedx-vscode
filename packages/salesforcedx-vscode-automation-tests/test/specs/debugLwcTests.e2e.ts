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
import { retryOperation } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
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
  getTextEditor,
  waitForAndGetCodeLens
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { SideBarView, TreeItem, after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';
import { logTestStart } from '../utils/loggingHelper';

describe('Debug LWC Tests', () => {
  let testSetup: TestSetup;
  let lwcFolderPath: string;
  let relativeLwcPath: string;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'DebugLWCTests',
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
    relativeLwcPath = path.join('force-app', 'main', 'default', 'lwc');
    lwcFolderPath = path.join(testSetup.projectFolderPath!, relativeLwcPath);

    // Hide copilot
    await tryToHideCopilot();

    // Close both Welcome and Running Extensions tabs
    await closeAllEditors();

    // Create LWC1 and test
    await createLwc('lwc1', lwcFolderPath);

    // Create LWC2 and test
    await createLwc('lwc2', lwcFolderPath);

    // Install Jest unit testing tools for LWC
    await installJestUTToolsForLwc(testSetup.projectFolderPath);
    await reloadWindow(Duration.seconds(30));
  });

  it('Debug All Tests on a LWC via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Debug All tests on a LWC via the Test Sidebar');
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
      `${path.join(relativeLwcPath, 'lwc1', '__tests__', 'lwc1.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    await executeQuickPick('Testing: Focus on LWC Tests View', Duration.seconds(3));
    await verifyTestIconColor(lwcTestsItems[0], 'testPass');
  });

  it('Debug Single Test via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Debug Single Test via the Test Sidebar');
    const workbench = getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');
    expect(testingView).to.not.be.undefined;
    // Open the Test Sidebar
    const testingSideBarView = await testingView!.openView();
    expect(testingSideBarView).to.be.instanceOf(SideBarView);

    // Hover a test name under one of the test lwc sections and click the debug button that is shown to the right of the test name on the Test sidebar
    const lwcTestsSection = await getTestsSection(workbench, 'LWC Tests');
    const lwcTestItem = await lwcTestsSection.findItem('displays greeting');
    if (!lwcTestItem) {
      throw new Error('Expected TreeItem but got undefined');
    }
    if (!(lwcTestItem instanceof TreeItem)) {
      throw new Error(`Expected TreeItem but got different item type: ${typeof lwcTestItem}`);
    }
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
      `${path.join(relativeLwcPath, 'lwc1', '__tests__', 'lwc1.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    await runCommandFromCommandPrompt(workbench, 'Testing: Focus on LWC Tests View', Duration.seconds(3));
    await verifyTestIconColor(lwcTestItem, 'testPass');
  });

  it('SFDX: Debug Current Lightning Web Component Test File from Command Palette', async () => {
    logTestStart(testSetup, 'SFDX: Debug Current Lightning Web Component Test File from Command Palette');

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
      `${path.join(relativeLwcPath, 'lwc1', '__tests__', 'lwc1.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  // TODO: This test is skipped because of W-15666391 https://gus.lightning.force.com/lightning/r/ADM_Work__c/a07EE00001qWb1IYAS/view
  it.skip('Debug All Tests via Code Lens action', async () => {
    logTestStart(testSetup, 'Debug All Tests via Code Lens action');
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc1.test.js');

    // Go to the top of the file
    log('Go to the top of the file');
    const inputBox = await executeQuickPick('Go to Line/Column', Duration.seconds(3));
    await inputBox.setText(':1');
    await inputBox.confirm();
    log('Go to the top of the file done');

    // Click the "Debug" code lens at the top of the class
    await retryOperation(
      async () => {
        log('Debug All Tests: Finding code lens');
        const debugAllTestsOption = await waitForAndGetCodeLens(textEditor, 'Debug All Tests');
        expect(debugAllTestsOption).to.not.be.undefined;
        log('Debug All Tests: Code lens found, waiting before click');
        await pause(Duration.seconds(2));
        log('Debug All Tests: Clicking code lens');
        await debugAllTestsOption!.click();
        log('Debug All Tests: Code lens clicked successfully');
      },
      3,
      'DebugLwcTests - Error clicking debug all tests option'
    );
    await pause(Duration.seconds(15));

    // Continue with the debug session
    await continueDebugging(2, 30);

    // Verify test results are listed on the terminal
    // Also verify that all tests pass
    const terminalText = await getTerminalViewText(workbench, 15);
    const expectedTexts = [
      'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'Test Suites: 1 passed, 1 total',
      'Tests:       2 passed, 2 total',
      'Snapshots:   0 total',
      'Ran all test suites matching',
      `${path.join(relativeLwcPath, 'lwc1', '__tests__', 'lwc1.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText, expectedTexts);
  });

  it.skip('Debug Single Test via Code Lens action', async () => {
    logTestStart(testSetup, 'Debug Single Test via Code Lens action');

    // Click the "Debug Test" code lens at the top of one of the test methods
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc2.test.js');

    await retryOperation(
      async () => {
        log('Debug Single Test: Finding code lens');
        const debugTestOption = await waitForAndGetCodeLens(textEditor, 'Debug Test');
        expect(debugTestOption).to.not.be.undefined;
        log('Debug Single Test: Code lens found, waiting before click');
        await pause(Duration.seconds(2));
        log('Debug Single Test: Clicking code lens');
        await debugTestOption!.click();
        log('Debug Single Test: Code lens clicked successfully');
      },
      3,
      'DebugLwcTests - Error clicking debug test option'
    );

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
      `${path.join(relativeLwcPath, 'lwc2', '__tests__', 'lwc2.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  it('SFDX: Debug Current Lightning Web Component Test File from main toolbar', async () => {
    logTestStart(testSetup, 'SFDX: Debug Current Lightning Web Component Test File from main toolbar');

    // Debug SFDX: Debug Current Lightning Web Component Test File
    const workbench = getWorkbench();
    const editorView = workbench.getEditorView();
    const debugTestButtonToolbar = await editorView.getAction('SFDX: Debug Current Lightning Web Component Test File');
    expect(debugTestButtonToolbar).to.not.be.undefined;
    await debugTestButtonToolbar!.click();
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
      `${path.join(relativeLwcPath, 'lwc2', '__tests__', 'lwc2.test.js')}`
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
