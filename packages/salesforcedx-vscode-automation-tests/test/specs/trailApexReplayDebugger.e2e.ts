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
import { By, InputBox, QuickOpenBox, TextEditor, after } from 'vscode-extension-tester';

/**
 * This test suite walks through the same steps performed in the "Find and Fix Bugs with Apex Replay Debugger" Trailhead Module;
 * which can be found with the following link:
 * https://trailhead.salesforce.com/content/learn/projects/find-and-fix-bugs-with-apex-replay-debugger
 */
describe('"Find and Fix Bugs with Apex Replay Debugger" Trailhead Module', async () => {
  let prompt: QuickOpenBox | InputBox;
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'TrailApexReplayDebugger'
  };

  step('Set up the testing environment', async () => {
    utilities.log('TrailApexReplayDebugger - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);

    // Create Apex class AccountService
    await utilities.createApexClassWithBugs();

    // Push source to org
    await utilities.executeQuickPick(
      'SFDX: Push Source to Default Org and Ignore Conflicts',
      utilities.Duration.seconds(1)
    );

    let successPushNotificationWasFound;
    try {
      successPushNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successPushNotificationWasFound).to.equal(true);
    } catch (error) {
      await utilities.getWorkbench().openNotificationsCenter();
      successPushNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successPushNotificationWasFound).to.equal(true);
    }
  });

  step('Verify LSP finished indexing', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);

    // Get Apex LSP Status Bar
    const statusBar = await utilities.getStatusBarItemWhichIncludes('Editor Language Status');
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
  });

  step('Run Apex Tests', async () => {
    utilities.log('TrailApexReplayDebugger - Run Apex Tests');
    // Run SFDX: Run Apex tests.
    await utilities.clearOutputView();
    prompt = await utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await utilities.getWorkbench().openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('Assertion Failed: incorrect ticker symbol');
    expect(outputPanelText).to.contain('Expected: CRM, Actual: SFDC');
  });

  step('Set Breakpoints and Checkpoints', async () => {
    utilities.log('TrailApexReplayDebugger - Set Breakpoints and Checkpoints');
    // Get open text editor
    const workbench = utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'AccountService.cls');
    await textEditor.moveCursor(8, 5);
    await utilities.pause(utilities.Duration.seconds(1));

    // Run SFDX: Toggle Checkpoint.
    prompt = await utilities.executeQuickPick('SFDX: Toggle Checkpoint', utilities.Duration.seconds(1));

    // Verify checkpoint is present
    const breakpoints = await workbench.findElements(By.css('div.codicon-debug-breakpoint-conditional'));
    expect(breakpoints.length).to.equal(1);

    // Run SFDX: Update Checkpoints in Org.
    prompt = await utilities.executeQuickPick('SFDX: Update Checkpoints in Org', utilities.Duration.seconds(20));
    // Verify checkpoints updating results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Apex Replay Debugger',
      'Starting SFDX: Update Checkpoints in Org',
      10
    );
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain(
      'SFDX: Update Checkpoints in Org, Step 6 of 6: Confirming successful checkpoint creation'
    );
    expect(outputPanelText).to.contain('Ending SFDX: Update Checkpoints in Org');
  });

  step('SFDX: Turn On Apex Debug Log for Replay Debugger', async () => {
    utilities.log('TrailApexReplayDebugger - SFDX: Turn On Apex Debug Log for Replay Debugger');
    // Run SFDX: Turn On Apex Debug Log for Replay Debugger
    await utilities.clearOutputView();
    await utilities.executeQuickPick(
      'SFDX: Turn On Apex Debug Log for Replay Debugger',
      utilities.Duration.seconds(10)
    );

    // Look for the success notification that appears which says, "SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    // Verify content on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Turn On Apex Debug Log for Replay Debugger',
      10
    );
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('SFDX: Turn On Apex Debug Log for Replay Debugger ');
    expect(outputPanelText).to.contain('ended with exit code 0');
  });

  step('Run Apex Tests', async () => {
    utilities.log('TrailApexReplayDebugger - Run Apex Tests');
    // Run SFDX: Run Apex tests.
    await utilities.clearOutputView();
    prompt = await utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await utilities.getWorkbench().openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('Assertion Failed: incorrect ticker symbol');
    expect(outputPanelText).to.contain('Expected: CRM, Actual: SFDC');
  });

  step('SFDX: Get Apex Debug Logs', async () => {
    utilities.log('TrailApexReplayDebugger - SFDX: Get Apex Debug Logs');
    // Run SFDX: Get Apex Debug Logs
    const workbench = utilities.getWorkbench();
    prompt = await utilities.executeQuickPick('SFDX: Get Apex Debug Logs', utilities.Duration.seconds(0));

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(/Getting Apex debug logs/, utilities.Duration.TEN_MINUTES);
    await utilities.pause(utilities.Duration.seconds(2));
    // Select a log file
    const quickPicks = await prompt.getQuickPicks();
    expect(quickPicks).to.not.be.undefined;
    expect(quickPicks.length).to.be.greaterThan(0);
    await prompt.selectQuickPick('User User - ApexTestHandler');

    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Get Apex Debug Logs successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    // Verify content on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Apex',
      'Starting SFDX: Get Apex Debug Logs',
      10
    );
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('|EXECUTION_STARTED');
    expect(outputPanelText).to.contain('|EXECUTION_FINISHED');
    expect(outputPanelText).to.contain('ended SFDX: Get Apex Debug Logs');

    // Verify content on log file
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    const textEditor = (await editorView.openEditor(title!)) as TextEditor;
    const executionStarted = await textEditor.getLineOfText('|EXECUTION_STARTED');
    const executionFinished = await textEditor.getLineOfText('|EXECUTION_FINISHED');
    expect(executionStarted).to.be.greaterThan(0);
    expect(executionFinished).to.be.greaterThan(0);
  });

  step('Replay an Apex Debug Log', async () => {
    utilities.log('TrailApexReplayDebugger - Replay an Apex Debug Log');
    // Run SFDX: Launch Apex Replay Debugger with Current File
    await utilities.executeQuickPick(
      'SFDX: Launch Apex Replay Debugger with Current File',
      utilities.Duration.seconds(30)
    );

    // Continue with the debug session
    await utilities.continueDebugging(2, 30);
  });

  step('Push Fixed Metadata to Org', async () => {
    if (process.platform === 'darwin') {
      utilities.log('TrailApexReplayDebugger - Push Fixed Metadata to Org');
      // Get open text editor
      const workbench = utilities.getWorkbench();
      const textEditor = await utilities.getTextEditor(workbench, 'AccountService.cls');
      await textEditor.setTextAtLine(6, '\t\t\tTickerSymbol = tickerSymbol');
      await textEditor.save();
      await utilities.pause(utilities.Duration.seconds(2));

      // Push source to org
      await utilities.executeQuickPick(
        'SFDX: Push Source to Default Org and Ignore Conflicts',
        utilities.Duration.seconds(10)
      );

      let successPushNotificationWasFound;
      try {
        successPushNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
          /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
          utilities.Duration.TEN_MINUTES
        );
        expect(successPushNotificationWasFound).to.equal(true);
      } catch (error) {
        await utilities.getWorkbench().openNotificationsCenter();
        successPushNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
          /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
          utilities.Duration.ONE_MINUTE
        );
        expect(successPushNotificationWasFound).to.equal(true);
      }
    }
  });

  step('Run Apex Tests to Verify Fix', async () => {
    if (process.platform === 'darwin') {
      utilities.log('TrailApexReplayDebugger - Run Apex Tests to Verify Fix');
      // Run SFDX: Run Apex tests.
      await utilities.clearOutputView();
      prompt = await utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1));

      // Select the "AccountServiceTest" file
      await prompt.selectQuickPick('AccountServiceTest');

      let successNotificationWasFound;
      try {
        successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
          /SFDX: Run Apex Tests successfully ran/,
          utilities.Duration.TEN_MINUTES
        );
        expect(successNotificationWasFound).to.equal(true);
      } catch (error) {
        await utilities.getWorkbench().openNotificationsCenter();
        successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
          /SFDX: Run Apex Tests successfully ran/,
          utilities.Duration.ONE_MINUTE
        );
        expect(successNotificationWasFound).to.equal(true);
      }

      // Verify test results are listed on vscode's Output section
      const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
      expect(outputPanelText).to.not.be.undefined;
      expect(outputPanelText).to.contain('AccountServiceTest.should_create_account');
      expect(outputPanelText).to.contain('Pass');
    }
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log('TrailApexReplayDebugger - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
