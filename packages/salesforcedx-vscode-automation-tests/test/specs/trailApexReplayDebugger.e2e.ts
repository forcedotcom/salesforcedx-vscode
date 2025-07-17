/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Duration,
  log,
  pause,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import {
  retryOperation,
  verifyNotificationWithRetry
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import { createApexClassWithBugs } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { continueDebugging } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  attemptToFindOutputPanelText,
  clearOutputView,
  executeQuickPick,
  getStatusBarItemWhichIncludes,
  getTextEditor,
  getWorkbench,
  moveCursorWithFallback,
  waitForNotificationToGoAway
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { By, InputBox, QuickOpenBox, TextEditor } from 'vscode-extension-tester';
import { logTestStart } from '../utils/loggingHelper';

/**
 * This test suite walks through the same steps performed in the "Find and Fix Bugs with Apex Replay Debugger" Trailhead Module;
 * which can be found with the following link:
 * https://trailhead.salesforce.com/content/learn/projects/find-and-fix-bugs-with-apex-replay-debugger
 */
describe('"Find and Fix Bugs with Apex Replay Debugger" Trailhead Module', () => {
  let prompt: QuickOpenBox | InputBox;
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'TrailApexReplayDebugger'
  };

  before('Set up the testing environment', async () => {
    log('TrailApexReplayDebugger - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);

    // Create Apex class AccountService
    await createApexClassWithBugs();

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', Duration.seconds(1));

    await verifyNotificationWithRetry(
      /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
      Duration.TEN_MINUTES
    );
  });

  it('Verify LSP finished indexing', async () => {
    logTestStart(testSetup, 'Verify LSP finished indexing');

    // Get Apex LSP Status Bar
    const statusBar = await getStatusBarItemWhichIncludes('Editor Language Status');
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
  });

  it('Run Apex Tests', async () => {
    logTestStart(testSetup, 'Run Apex Tests');
    // Run SFDX: Run Apex tests.
    await clearOutputView();
    prompt = await executeQuickPick('SFDX: Run Apex Tests', Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).to.contain('Assertion Failed: incorrect ticker symbol');
    expect(outputPanelText).to.contain('Expected: CRM, Actual: SFDC');
  });

  it('Set Breakpoints and Checkpoints', async () => {
    logTestStart(testSetup, 'Set Breakpoints and Checkpoints');
    // Get open text editor
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'AccountService.cls');
    await moveCursorWithFallback(textEditor, 8, 5);
    await pause(Duration.seconds(1));

    // Run SFDX: Toggle Checkpoint.
    prompt = await executeQuickPick('SFDX: Toggle Checkpoint', Duration.seconds(1));

    // Verify checkpoint is present
    const breakpoints = await workbench.findElements(By.css('div.codicon-debug-breakpoint-conditional'));
    expect(breakpoints.length).to.equal(1);

    // Run SFDX: Update Checkpoints in Org.
    prompt = await executeQuickPick('SFDX: Update Checkpoints in Org', Duration.seconds(20));
    // Verify checkpoints updating results are listed on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText(
      'Apex Replay Debugger',
      'Starting SFDX: Update Checkpoints in Org',
      10
    );
    expect(outputPanelText).to.contain(
      'SFDX: Update Checkpoints in Org, Step 6 of 6: Confirming successful checkpoint creation'
    );
    expect(outputPanelText).to.contain('Ending SFDX: Update Checkpoints in Org');
  });

  it('SFDX: Turn On Apex Debug Log for Replay Debugger', async () => {
    logTestStart(testSetup, 'SFDX: Turn On Apex Debug Log for Replay Debugger');
    // Run SFDX: Turn On Apex Debug Log for Replay Debugger
    await clearOutputView();
    await executeQuickPick('SFDX: Turn On Apex Debug Log for Replay Debugger', Duration.seconds(10));

    // Look for the success notification that appears which says, "SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran".
    await verifyNotificationWithRetry(
      /SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran/,
      Duration.TEN_MINUTES
    );

    // Verify content on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Turn On Apex Debug Log for Replay Debugger',
      10
    );
    expect(outputPanelText).to.contain('SFDX: Turn On Apex Debug Log for Replay Debugger');
    expect(outputPanelText).to.contain('ended with exit code 0');
  });

  it('Run Apex Tests', async () => {
    logTestStart(testSetup, 'Run Apex Tests');
    // Run SFDX: Run Apex tests.
    await clearOutputView();
    prompt = await executeQuickPick('SFDX: Run Apex Tests', Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('Assertion Failed: incorrect ticker symbol');
    expect(outputPanelText).to.contain('Expected: CRM, Actual: SFDC');
  });

  it('SFDX: Get Apex Debug Logs', async () => {
    logTestStart(testSetup, 'SFDX: Get Apex Debug Logs');
    // Run SFDX: Get Apex Debug Logs
    const workbench = getWorkbench();
    prompt = await executeQuickPick('SFDX: Get Apex Debug Logs', Duration.seconds(0));

    // Wait for the command to execute
    await waitForNotificationToGoAway(/Getting Apex debug logs/, Duration.TEN_MINUTES);
    await pause(Duration.seconds(2));
    // Select a log file
    await retryOperation(
      async () => {
        const quickPicks = await prompt.getQuickPicks();
        expect(quickPicks).to.not.be.undefined;
        expect(quickPicks.length).to.be.greaterThan(0);
        await prompt.selectQuickPick('User User - ApexTestHandler');
      },
      3,
      'Failed to select log file from quick picks'
    );

    await verifyNotificationWithRetry(/SFDX: Get Apex Debug Logs successfully ran/, Duration.TEN_MINUTES);

    // Verify content on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText('Apex', 'Starting SFDX: Get Apex Debug Logs', 10);
    expect(outputPanelText).to.contain('|EXECUTION_STARTED');
    expect(outputPanelText).to.contain('|EXECUTION_FINISHED');
    expect(outputPanelText).to.contain('ended SFDX: Get Apex Debug Logs');

    // Verify content on log file
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    const textEditor = await editorView.openEditor(title!);
    if (!(textEditor instanceof TextEditor)) {
      throw new Error(`Expected TextEditor but got different editor type: ${typeof textEditor}`);
    }
    const executionStarted = await textEditor.getLineOfText('|EXECUTION_STARTED');
    const executionFinished = await textEditor.getLineOfText('|EXECUTION_FINISHED');
    expect(executionStarted).to.be.greaterThan(0);
    expect(executionFinished).to.be.greaterThan(0);
  });

  it('Replay an Apex Debug Log', async () => {
    logTestStart(testSetup, 'Replay an Apex Debug Log');
    // Run SFDX: Launch Apex Replay Debugger with Current File
    await executeQuickPick('SFDX: Launch Apex Replay Debugger with Current File', Duration.seconds(30));

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  it('Push Fixed Metadata to Org', async () => {
    if (process.platform === 'darwin') {
      logTestStart(testSetup, 'Push Fixed Metadata to Org');
      // Get open text editor
      const workbench = getWorkbench();
      const textEditor = await getTextEditor(workbench, 'AccountService.cls');
      await textEditor.setTextAtLine(6, '\t\t\tTickerSymbol = tickerSymbol');
      await textEditor.save();
      await pause(Duration.seconds(2));

      // Push source to org
      await executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', Duration.seconds(10));

      await verifyNotificationWithRetry(
        /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
        Duration.TEN_MINUTES
      );
    }
  });

  it('Run Apex Tests to Verify Fix', async () => {
    if (process.platform === 'darwin') {
      logTestStart(testSetup, 'Run Apex Tests to Verify Fix');
      // Run SFDX: Run Apex tests.
      await clearOutputView();
      prompt = await executeQuickPick('SFDX: Run Apex Tests', Duration.seconds(1));

      // Select the "AccountServiceTest" file
      await prompt.selectQuickPick('AccountServiceTest');

      await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

      // Verify test results are listed on vscode's Output section
      const outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
      expect(outputPanelText).to.contain('AccountServiceTest.should_create_account');
      expect(outputPanelText).to.contain('Pass');
    }
  });

  after('Tear down and clean up the testing environment', async () => {
    log('TrailApexReplayDebugger - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
