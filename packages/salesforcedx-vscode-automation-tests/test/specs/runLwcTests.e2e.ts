/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Duration,
  pause,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import {
  installJestUTToolsForLwc,
  createLwc
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import {
  getTestsSection,
  runTestCaseFromSideBar,
  verifyTestIconColor,
  verifyTestItemsInSideBar
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  closeAllEditors,
  executeQuickPick,
  getTerminalViewText,
  getTextEditor,
  getWorkbench,
  reloadWindow,
  verifyOutputPanelText,
  waitForAndGetCodeLens
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { TreeItem, after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';
import { logTestStart } from '../utils/loggingHelper';

describe('Run LWC Tests', () => {
  let testSetup: TestSetup;
  let lwcFolderPath: string;
  let relativeLwcPath: string;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'RunLWCTests',
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
  });

  it('SFDX: Run All Lightning Web Component Tests from Command Palette', async () => {
    logTestStart(testSetup, 'SFDX: Run All Lightning Web Component Tests from Command Palette');

    // Run SFDX: Run All Lightning Web Component Tests.
    await executeQuickPick('SFDX: Run All Lightning Web Component Tests', Duration.seconds(1));

    // Verify test results are listed on the terminal
    // Also verify that all tests pass
    const workbench = getWorkbench();
    const terminalText = await getTerminalViewText(workbench, 10);

    const expectedTexts = [
      'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
      'Test Suites: 2 passed, 2 total',
      'Tests:       4 passed, 4 total',
      'Snapshots:   0 total',
      'Ran all test suites.'
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  it('SFDX: Refresh Lightning Web Component Test Explorer', async () => {
    logTestStart(testSetup, 'SFDX: Refresh Lightning Web Component Test Explorer');
    await executeQuickPick('Testing: Focus on LWC Tests View', Duration.seconds(1));
    // Run command SFDX: Refresh Lightning Web Component Test Explorer
    await executeQuickPick('SFDX: Refresh Lightning Web Component Test Explorer', Duration.seconds(2));
    // Open the Tests Sidebar
    const workbench = getWorkbench();
    const lwcTestsSection = await getTestsSection(workbench, 'LWC Tests');
    let lwcTestsItems = await lwcTestsSection.getVisibleItems();
    if (!Array.isArray(lwcTestsItems)) {
      throw new Error(`Expected Array<TreeItem> but got different item type: ${typeof lwcTestsItems}`);
    }

    // Run command SFDX: Run All Lightning Web Component Tests
    await executeQuickPick('SFDX: Run All Lightning Web Component Tests', Duration.seconds(2));

    // Get tree items again
    lwcTestsItems = await lwcTestsSection.getVisibleItems();
    if (!Array.isArray(lwcTestsItems)) {
      throw new Error(`Expected Array<TreeItem> but got different item type: ${typeof lwcTestsItems}`);
    }

    // Verify the tests that ran are labeled with a green dot on the Test sidebar
    for (const item of lwcTestsItems) {
      if (!(item instanceof TreeItem)) {
        throw new Error(`Expected TreeItem but got different item type: ${typeof item}`);
      }
      await verifyTestIconColor(item, 'testPass');
    }

    // Run command SFDX: Refresh Lightning Web Component Test Explorer again to reset status
    await executeQuickPick('SFDX: Refresh Lightning Web Component Test Explorer', Duration.seconds(2));

    // Get tree items again
    lwcTestsItems = await lwcTestsSection.getVisibleItems();
    if (!Array.isArray(lwcTestsItems)) {
      throw new Error(`Expected Array<TreeItem> but got different item type: ${typeof lwcTestsItems}`);
    }

    // Verify the tests are now labeled with a blue dot on the Test sidebar
    for (const item of lwcTestsItems) {
      if (!(item instanceof TreeItem)) {
        throw new Error(`Expected TreeItem but got different item type: ${typeof item}`);
      }
      await verifyTestIconColor(item, 'testNotRun');
    }
  });

  it('Run All tests via Test Sidebar', async () => {
    logTestStart(testSetup, 'Run All tests via Test Sidebar');
    const workbench = getWorkbench();
    const lwcTestsSection = await getTestsSection(workbench, 'LWC Tests');
    const expectedItems = ['lwc1', 'lwc2', 'displays greeting', 'is defined'];
    const lwcTestsItems = await verifyTestItemsInSideBar(
      lwcTestsSection,
      'SFDX: Refresh Lightning Web Component Test Explorer',
      expectedItems,
      6,
      2
    );

    // Click the run tests button on the top right corner of the Test sidebar
    await lwcTestsSection.click();
    const runTestsAction = await lwcTestsSection.getAction('SFDX: Run All Lightning Web Component Tests');
    expect(runTestsAction).to.not.be.undefined;
    await runTestsAction!.click();

    // Verify test results are listed on the terminal
    // Also verify that all tests pass
    const terminalText = await getTerminalViewText(workbench, 10);

    const expectedTexts = [
      'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
      'Test Suites: 2 passed, 2 total',
      'Tests:       4 passed, 4 total',
      'Snapshots:   0 total',
      'Ran all test suites.'
    ];
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    for (const item of lwcTestsItems) {
      await verifyTestIconColor(item, 'testPass');
    }
  });

  it('Run All Tests on a LWC via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Run All Tests on a LWC via the Test Sidebar');
    const workbench = getWorkbench();

    // Click the run test button that is shown to the right when you hover a test class name on the Test sidebar
    const terminalText = await runTestCaseFromSideBar(
      workbench,
      'LWC Tests',
      'lwc1',
      'SFDX: Run Lightning Web Component Test File'
    );

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
    await closeAllEditors();
  });

  it('Run Single Test via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Run Single Test via the Test Sidebar');
    const workbench = getWorkbench();

    // Hover a test name under one of the test lwc sections and click the run button that is shown to the right of the test name on the Test sidebar
    const terminalText = await runTestCaseFromSideBar(
      workbench,
      'LWC Tests',
      'displays greeting',
      'SFDX: Run Lightning Web Component Test Case'
    );
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
  });

  it('SFDX: Navigate to Lightning Web Component Test', async () => {
    // Verify that having clicked the test case took us to the test file.
    await reloadWindow();
    await pause(Duration.seconds(10));
    const workbench = getWorkbench();
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('lwc1.test.js');
  });

  it('SFDX: Run Current Lightning Web Component Test File from Command Palette', async () => {
    logTestStart(testSetup, 'SFDX: Run Current Lightning Web Component Test File');

    // Run SFDX: Run Current Lightning Web Component Test File
    await executeQuickPick('SFDX: Run Current Lightning Web Component Test File', Duration.seconds(1));

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const workbench = getWorkbench();
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

  it.skip('Run All Tests via Code Lens action', async () => {
    // Skipping as this feature is currently not working
    logTestStart(testSetup, 'Run All Tests via Code Lens action');
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc1.test.js');

    // Click the "Run" code lens at the top of the class
    const runAllTestsOption = await waitForAndGetCodeLens(textEditor, 'Run All Tests');
    expect(runAllTestsOption).to.not.be.undefined;
    await runAllTestsOption!.click();

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
  });

  it.skip('Run Single Test via Code Lens action', async () => {
    logTestStart(testSetup, 'Run Single Test via Code Lens action');

    // Click the "Run Test" code lens at the top of one of the test methods
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc2.test.js');
    const runTestOption = await waitForAndGetCodeLens(textEditor, 'Run Test');
    expect(runTestOption).to.not.be.undefined;
    await runTestOption!.click();

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

  it('SFDX: Run Current Lightning Web Component Test File from main toolbar', async () => {
    logTestStart(testSetup, 'SFDX: Run Current Lightning Web Component Test File from main toolbar');

    // Run SFDX: Run Current Lightning Web Component Test File
    const workbench = getWorkbench();
    await getTextEditor(workbench, 'lwc2.test.js');
    const editorView = workbench.getEditorView();
    const runTestButtonToolbar = await editorView.getAction('SFDX: Run Current Lightning Web Component Test File');
    expect(runTestButtonToolbar).to.not.be.undefined;
    await runTestButtonToolbar?.click();

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
