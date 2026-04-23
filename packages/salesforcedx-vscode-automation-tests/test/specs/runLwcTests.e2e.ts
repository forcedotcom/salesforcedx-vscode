/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Duration,
  openFile,
  pause,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { retryOperation } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import {
  createLwc,
  installJestUTToolsForLwc
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  closeAllEditors,
  executeQuickPick,
  getStatusBarItemWhichIncludes,
  getTextEditor,
  getWorkbench,
  reloadWindow,
  verifyOutputPanelText,
  waitForAndGetCodeLens
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { findTestItemByName, getTestResultsTabText } from '../utils/testsHelper';
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

    // Close both Welcome and Running Extensions tabs
    await closeAllEditors();

    await createLwc('lwc1', lwcFolderPath);

    await createLwc('lwc2', lwcFolderPath);

    await installJestUTToolsForLwc(testSetup.projectFolderPath);

    await reloadWindow(Duration.seconds(20));
  });

  it('Verify LWC LSP finished indexing in status bar', async () => {
    logTestStart(testSetup, 'Verify LWC LSP finished indexing in status bar');

    await retryOperation(
      async () => {
        await openFile(path.join(lwcFolderPath, 'lwc1', 'lwc1.html'));

        const statusBar = await getStatusBarItemWhichIncludes('Editor Language Status');
        await statusBar.click();
        expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
      },
      5,
      'LWC language status did not reach indexing complete'
    );
  });

  it('Run All LWC tests via native Test Explorer', async () => {
    logTestStart(testSetup, 'Run All LWC tests via native Test Explorer');

    // Open VS Code's native Test Explorer
    await retryOperation(
      async () => executeQuickPick('Testing: Focus on Test Explorer View', Duration.seconds(2)),
      3,
      'RunLwcTests - Error focusing on test explorer view'
    );

    // Refresh so the LWC TestController populates test items
    await retryOperation(
      async () => executeQuickPick('Test: Refresh Tests', Duration.seconds(2)),
      3,
      'RunLwcTests - Error refreshing test explorer'
    );

    // Run all tests via the native command (invokes our Run profile with no include)
    await executeQuickPick('Test: Run All Tests', Duration.seconds(2));

    // Wait for tests to complete
    await pause(Duration.seconds(5));

    // Verify jest ran both files and all tests passed (results are in Test Results tab)
    const testResultsText = await getTestResultsTabText('Lightning Web Components');

    const expectedTexts = [
      'SFDX: Run All LWC Tests',
      'PASS',
      'force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
      'Test Suites:  2 passed, 2 total',
      'Tests:        4 passed, 4 total'
    ];
    expect(testResultsText).to.not.be.undefined;
    await verifyOutputPanelText(testResultsText!, expectedTexts);
  });

  it('Run All Tests on a LWC via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Run All Tests on a LWC via the Test Sidebar');

    // Native Test Explorer exposes a per-item "Run Test" action button
    // Wrap in retryOperation to handle potential stale element references
    await retryOperation(
      async () => {
        const lwc1Item = await findTestItemByName('lwc1');
        await lwc1Item.click();
        const runTestAction = await lwc1Item.getActionButton('Run Test');
        expect(runTestAction).to.not.be.undefined;
        await runTestAction!.click();
      },
      3,
      'Failed to click Run Test button on lwc1 item in Test Sidebar'
    );

    // Wait for tests to complete
    await pause(Duration.seconds(5));

    const testResultsText = await getTestResultsTabText('Lightning Web Components');
    const expectedTexts = [
      'PASS',
      'force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'Test Suites:  1 passed, 1 total',
      'Tests:        2 passed, 2 total'
    ];
    expect(testResultsText).to.not.be.undefined;
    await verifyOutputPanelText(testResultsText!, expectedTexts);
    await closeAllEditors();
  });

  it('Run Single Test via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Run Single Test via the Test Sidebar');

    // Wrap in retryOperation to handle potential stale element references
    await retryOperation(
      async () => {
        const testCaseItem = await findTestItemByName('displays greeting');
        await testCaseItem.click();
        const runTestAction = await testCaseItem.getActionButton('Run Test');
        expect(runTestAction).to.not.be.undefined;
        await runTestAction!.click();
      },
      3,
      'Failed to click Run Test button on displays greeting test in Test Sidebar'
    );

    // Wait for tests to complete
    await pause(Duration.seconds(5));

    const testResultsText = await getTestResultsTabText('Lightning Web Components');
    const expectedTexts = [
      'PASS',
      'force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'Test Suites:  1 passed, 1 total',
      'Tests:        1 skipped, 1 passed, 2 total'
    ];
    expect(testResultsText).to.not.be.undefined;
    await verifyOutputPanelText(testResultsText!, expectedTexts);
  });

  it('SFDX: Run Current Lightning Web Component Test File from Command Palette', async () => {
    logTestStart(testSetup, 'SFDX: Run Current Lightning Web Component Test File from Command Palette');

    await retryOperation(
      async () => {
        await executeQuickPick('SFDX: Run Current Lightning Web Component Test File', Duration.seconds(5));

        // Wait for tests to complete
        await pause(Duration.seconds(5));

        const testResultsText = await getTestResultsTabText('Lightning Web Components');
        const expectedTexts = [
          'PASS',
          'force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
          'Test Suites:  1 passed, 1 total',
          'Tests:        2 passed, 2 total'
        ];

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        expect(testResultsText).to.not.be.undefined;
        await verifyOutputPanelText(testResultsText, expectedTexts);
      },
      3,
      'Failed to run current lightning web component test file from command palette'
    );
  });

  // TODO: This test is skipped in Ubuntu because of a flapper after adding code lens to describe blocks
  (process.platform === 'linux' ? it.skip : it)('Run All Tests via Code Lens action', async () => {
    logTestStart(testSetup, 'Run All Tests via Code Lens action');
    const workbench = getWorkbench();

    // Close all editors first to ensure a clean state
    await closeAllEditors();

    // Wrap in retryOperation to handle timing issues with code lens appearing
    await retryOperation(
      async () => {
        const textEditor = await getTextEditor(workbench, 'lwc1.test.js');
        const runAllTestsOption = await waitForAndGetCodeLens(textEditor, 'Run All Tests');
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        expect(runAllTestsOption).to.not.be.undefined;
        await runAllTestsOption!.click();
      },
      3,
      'Failed to find and click Run All Tests code lens on lwc1.test.js'
    );

    // Wait for tests to complete
    await pause(Duration.seconds(5));

    const testResultsText = await getTestResultsTabText('Lightning Web Components');
    const expectedTexts = [
      'PASS',
      'force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
      'Test Suites:  1 passed, 1 total',
      'Tests:        2 passed, 2 total'
    ];
    expect(testResultsText).to.not.be.undefined;
    await verifyOutputPanelText(testResultsText!, expectedTexts);
  });

  // TODO: This test is skipped in Ubuntu because of a flapper after adding code lens to describe blocks
  (process.platform === 'linux' ? it.skip : it)('Run Single Test via Code Lens action', async () => {
    logTestStart(testSetup, 'Run Single Test via Code Lens action');

    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc2.test.js');
    const runTestOption = await waitForAndGetCodeLens(textEditor, 'Run Test');
    expect(runTestOption).to.not.be.undefined;
    await runTestOption!.click();

    // Wait for tests to complete
    await pause(Duration.seconds(5));

    const testResultsText = await getTestResultsTabText('Lightning Web Components');
    const expectedTexts = [
      'PASS',
      'force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
      'Test Suites:  1 passed, 1 total',
      'Tests:        1 skipped, 1 passed, 2 total'
    ];
    expect(testResultsText).to.not.be.undefined;
    await verifyOutputPanelText(testResultsText!, expectedTexts);
  });

  it('SFDX: Run Current Lightning Web Component Test File from main toolbar', async () => {
    logTestStart(testSetup, 'SFDX: Run Current Lightning Web Component Test File from main toolbar');

    const workbench = getWorkbench();
    await getTextEditor(workbench, 'lwc2.test.js');
    const editorView = workbench.getEditorView();
    const runTestButtonToolbar = await editorView.getAction('SFDX: Run Current Lightning Web Component Test File');
    expect(runTestButtonToolbar).to.not.be.undefined;
    await runTestButtonToolbar?.click();

    // Wait for tests to complete
    await pause(Duration.seconds(5));

    const testResultsText = await getTestResultsTabText('Lightning Web Components');
    const expectedTexts = [
      'PASS',
      'force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
      'Test Suites:  1 passed, 1 total',
      'Tests:        2 passed, 2 total'
    ];
    expect(testResultsText).to.not.be.undefined;
    await verifyOutputPanelText(testResultsText!, expectedTexts);
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
