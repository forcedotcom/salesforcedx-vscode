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
  openFile,
  pause
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import {
  retryOperation,
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import { createLwc } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { installJestUTToolsForLwc } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import { continueDebugging } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  closeAllEditors,
  getStatusBarItemWhichIncludes,
  reloadWindow,
  getWorkbench,
  executeQuickPick,
  getTerminalViewText,
  verifyOutputPanelText,
  getTextEditor,
  waitForAndGetCodeLens
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';
import { findTestItemByName } from '../utils/apexTestsHelper';
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

    await tryToHideCopilot();

    await closeAllEditors();

    await createLwc('lwc1', lwcFolderPath);

    await createLwc('lwc2', lwcFolderPath);

    await installJestUTToolsForLwc(testSetup.projectFolderPath);
    await reloadWindow(Duration.seconds(30));
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

  it('Debug All Tests on a LWC via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Debug All tests on a LWC via the Test Sidebar');
    const workbench = getWorkbench();

    // Open the native Test Explorer and refresh so LWC items populate
    await retryOperation(
      async () => executeQuickPick('Testing: Focus on Test Explorer View', Duration.seconds(3)),
      3,
      'DebugLwcTests - Error focusing on test explorer view'
    );
    await retryOperation(
      async () => executeQuickPick('Test: Refresh Tests', Duration.seconds(2)),
      3,
      'DebugLwcTests - Error refreshing test explorer'
    );
    await pause(Duration.seconds(10));

    // Click the Debug Test action on the lwc1 file item
    const lwc1Item = await findTestItemByName('lwc1');
    await lwc1Item.click();
    const debugTestsAction = await lwc1Item.getActionButton('Debug Test');
    expect(debugTestsAction).to.not.be.undefined;
    await debugTestsAction!.click();
    await pause(Duration.seconds(15));

    await continueDebugging(2);

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

  it('Debug Single Test via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Debug Single Test via the Test Sidebar');
    const workbench = getWorkbench();

    await retryOperation(
      async () => executeQuickPick('Testing: Focus on Test Explorer View', Duration.seconds(3)),
      3,
      'DebugLwcTests - Error focusing on test explorer view'
    );

    const testCaseItem = await findTestItemByName('displays greeting');
    await testCaseItem.click();
    const debugTestAction = await testCaseItem.getActionButton('Debug Test');
    expect(debugTestAction).to.not.be.undefined;
    await debugTestAction!.click();
    await pause(Duration.seconds(15));

    await continueDebugging(1);

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
  });

  it('SFDX: Debug Current Lightning Web Component Test File from Command Palette', async () => {
    logTestStart(testSetup, 'SFDX: Debug Current Lightning Web Component Test File from Command Palette');

    const workbench = getWorkbench();
    await executeQuickPick('SFDX: Debug Current Lightning Web Component Test File', Duration.seconds(15));

    await continueDebugging(2);

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

  // TODO: This test is skipped because of a flapper after adding code lens to describe blocks
  it.skip('Debug All Tests via Code Lens action', async () => {
    logTestStart(testSetup, 'Debug All Tests via Code Lens action');
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lwc1.test.js');

    log('Go to the top of the file');
    const inputBox = await executeQuickPick('Go to Line/Column', Duration.seconds(3));
    await inputBox.setText(':1');
    await inputBox.confirm();
    log('Go to the top of the file done');

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

    await continueDebugging(2, 30);

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

  // TODO: This test is skipped because of a flapper after adding code lens to describe blocks
  it.skip('Debug Single Test via Code Lens action', async () => {
    logTestStart(testSetup, 'Debug Single Test via Code Lens action');

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

    await continueDebugging(1);

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

    const workbench = getWorkbench();
    await getTextEditor(workbench, 'lwc2.test.js');
    const editorView = workbench.getEditorView();
    const debugTestButtonToolbar = await editorView.getAction('SFDX: Debug Current Lightning Web Component Test File');
    expect(debugTestButtonToolbar).to.not.be.undefined;
    await debugTestButtonToolbar!.click();
    await pause(Duration.seconds(15));

    await continueDebugging(2);

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
