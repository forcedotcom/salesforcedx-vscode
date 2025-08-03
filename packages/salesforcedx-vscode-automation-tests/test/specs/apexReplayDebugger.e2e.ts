/*
 * Copyright (c) 2024, salesforce.com, inc.
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
import {
  createApexClassWithTest,
  createAnonymousApexFile
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { continueDebugging } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  executeQuickPick,
  getWorkbench,
  getStatusBarItemWhichIncludes,
  clearOutputView,
  attemptToFindOutputPanelText,
  getTextEditor,
  waitForNotificationToGoAway,
  dismissAllNotifications
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { InputBox, QuickOpenBox, TextEditor } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';
import { logTestStart } from '../utils/loggingHelper';

describe('Apex Replay Debugger', () => {
  let prompt: QuickOpenBox | InputBox;
  let testSetup: TestSetup;
  let projectFolderPath: string;
  let classesFolderPath: string;
  let logFileTitle: string;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'ApexReplayDebugger',
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    log('ApexReplayDebugger - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    projectFolderPath = testSetup.projectFolderPath!;
    classesFolderPath = path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes');

    // Hide copilot
    await tryToHideCopilot();

    // Create Apex class file
    await createApexClassWithTest('ExampleApexClass', classesFolderPath);

    // Dismiss all notifications so the push one can be seen
    await dismissAllNotifications();

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(1));

    await verifyNotificationWithRetry(/SFDX: Push Source to Default Org successfully ran/, Duration.TEN_MINUTES);
  });

  // Since tests are sequential, we need to skip the rest of the tests if one fails
  beforeEach(function () {
    if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
      this.skip();
    }
  });

  it('Verify LSP finished indexing', async () => {
    logTestStart(testSetup, 'ApexReplayDebugger - Verify LSP finished indexing');

    // Get Apex LSP Status Bar
    const statusBar = await retryOperation(async () => await getStatusBarItemWhichIncludes('Editor Language Status'));
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
  });

  it('SFDX: Turn On Apex Debug Log for Replay Debugger', async () => {
    logTestStart(testSetup, 'ApexReplayDebugger - SFDX: Turn On Apex Debug Log for Replay Debugger');

    // Clear output before running the command
    await clearOutputView();

    // Run SFDX: Turn On Apex Debug Log for Replay Debugger
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
    expect(outputPanelText).to.contain('Ended SFDX: Turn On Apex Debug Log for Replay Debugger');
  });

  it('Run the Anonymous Apex Debugger with Currently Selected Text', async () => {
    logTestStart(testSetup, 'ApexReplayDebugger - Run the Anonymous Apex Debugger with Currently Selected Text');

    // Clear output before running the command
    await clearOutputView();

    // Get open text editor
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClassTest.cls');

    // Select text
    const findWidget = await textEditor.openFindWidget();
    await findWidget.setSearchText("ExampleApexClass.SayHello('Cody');");
    await pause(Duration.seconds(1));
    // Close finder tool
    await findWidget.close();
    await pause(Duration.seconds(1));

    // Run SFDX: Launch Apex Replay Debugger with Currently Selected Text.
    await executeQuickPick('SFDX: Execute Anonymous Apex with Currently Selected Text', Duration.seconds(1));

    await verifyNotificationWithRetry(/Execute Anonymous Apex successfully ran/, Duration.TEN_MINUTES);

    // Verify content on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText('Apex', 'Starting Execute Anonymous Apex', 10);
    expect(outputPanelText).to.contain('Compiled successfully.');
    expect(outputPanelText).to.contain('Executed successfully.');
    expect(outputPanelText).to.contain('|EXECUTION_STARTED');
    expect(outputPanelText).to.contain('|EXECUTION_FINISHED');
    expect(outputPanelText).to.contain('Ended Execute Anonymous Apex');
  });

  it('SFDX: Get Apex Debug Logs', async () => {
    logTestStart(testSetup, 'ApexReplayDebugger - SFDX: Get Apex Debug Logs');

    // Run SFDX: Get Apex Debug Logs
    const workbench = getWorkbench();
    await clearOutputView();
    await pause(Duration.seconds(2));

    await retryOperation(
      async () => {
        log('A');
        prompt = await executeQuickPick('SFDX: Get Apex Debug Logs', Duration.seconds(0));
        log('B');

        // Wait for the command to execute
        await waitForNotificationToGoAway(/Getting Apex debug logs/, Duration.TEN_MINUTES);
        log('C');
        await pause(Duration.seconds(5)); // Increased pause to allow quickpick to fully load

        // Select a log file with error handling
        log('D');
        const quickPicks = await prompt.getQuickPicks();
        log('E');
        expect(quickPicks).to.not.be.undefined;
        log('F');
        expect(quickPicks.length).to.be.greaterThanOrEqual(0);
        log('G');
        await prompt.selectQuickPick('User User - Api');
        log('H');
        await pause(Duration.seconds(2));
      },
      3,
      'Failed to select log file from quick picks'
    );

    log('I');
    await verifyNotificationWithRetry(/SFDX: Get Apex Debug Logs successfully ran/, Duration.TEN_MINUTES);
    log('J');

    // Verify content on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText('Apex', 'Starting SFDX: Get Apex Debug Logs', 10);
    log('K');
    expect(outputPanelText).to.contain('|EXECUTION_STARTED');
    log('L');
    expect(outputPanelText).to.contain('|EXECUTION_FINISHED');
    log('M');
    expect(outputPanelText).to.contain('Ended SFDX: Get Apex Debug Logs');
    log('N');

    // Verify content on log file
    const textEditor = await retryOperation(async () => {
      log('O');
      const editorView = workbench.getEditorView();
      log('P');
      const activeTab = await editorView.getActiveTab();
      log('Q');
      const title = await activeTab?.getTitle();
      log('R');
      if (title) logFileTitle = title;
      log('S');
      return await editorView.openEditor(title!);
    });

    log('T');
    if (!(textEditor instanceof TextEditor)) {
      log('U');
      throw new Error(`Expected TextEditor but got different editor type: ${typeof textEditor}`);
    }
    log('V');
    const executionStarted = await textEditor.getLineOfText('|EXECUTION_STARTED');
    log('W');
    const executionFinished = await textEditor.getLineOfText('|EXECUTION_FINISHED');
    log('X');
    expect(executionStarted).to.be.greaterThanOrEqual(1);
    log('Y');
    expect(executionFinished).to.be.greaterThanOrEqual(1);
    log('Z');
  });

  it('SFDX: Launch Apex Replay Debugger with Current File - log file', async () => {
    logTestStart(testSetup, 'ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Current File - log file');

    // Run SFDX: Launch Apex Replay Debugger with Current File
    await executeQuickPick('SFDX: Launch Apex Replay Debugger with Current File', Duration.seconds(10));

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  it('SFDX: Launch Apex Replay Debugger with Last Log File', async () => {
    logTestStart(testSetup, 'ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Last Log File');

    const logFilePath = path.join(projectFolderPath, '.sfdx', 'tools', 'debug', 'logs', logFileTitle);
    log(`logFilePath: ${logFilePath}`);

    // Run SFDX: Launch Apex Replay Debugger with Last Log File
    await retryOperation(
      async () => {
        await pause(Duration.seconds(2));
        prompt = await executeQuickPick('SFDX: Launch Apex Replay Debugger with Last Log File', Duration.seconds(1));

        if (!prompt) {
          throw new Error('Failed to get prompt from executeQuickPick');
        }

        await prompt.setText(logFilePath);
        await prompt.confirm();
      },
      3,
      'Failed to launch Apex Replay Debugger with Last Log File'
    );

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  it('SFDX: Launch Apex Replay Debugger with Current File - test class', async () => {
    logTestStart(testSetup, 'ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Current File - test class');

    // Run SFDX: Launch Apex Replay Debugger with Current File
    const workbench = getWorkbench();
    await getTextEditor(workbench, 'ExampleApexClassTest.cls');
    await executeQuickPick('SFDX: Launch Apex Replay Debugger with Current File', Duration.seconds(10));

    // Continue with the debug session
    await continueDebugging(2, 30);

    await verifyNotificationWithRetry(/Debug Test\(s\) successfully ran/, Duration.TEN_MINUTES);
  });

  it('Run the Anonymous Apex Debugger using the Command Palette', async () => {
    logTestStart(testSetup, 'ApexReplayDebugger - Run the Anonymous Apex Debugger using the Command Palette');

    // Clear output before running the command
    await clearOutputView();

    // Create anonymous apex file
    await createAnonymousApexFile(classesFolderPath);

    // Run SFDX: Launch Apex Replay Debugger with Editor Contents", using the Command Palette.
    await executeQuickPick('SFDX: Execute Anonymous Apex with Editor Contents', Duration.seconds(10));

    await verifyNotificationWithRetry(/Execute Anonymous Apex successfully ran/, Duration.TEN_MINUTES);

    // Verify content on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText('Apex', 'Starting Execute Anonymous Apex', 10);
    expect(outputPanelText).to.contain('Compiled successfully.');
    expect(outputPanelText).to.contain('Executed successfully.');
    expect(outputPanelText).to.contain('|EXECUTION_STARTED');
    expect(outputPanelText).to.contain('|EXECUTION_FINISHED');
    expect(outputPanelText).to.contain('Ended Execute Anonymous Apex');
  });

  it('SFDX: Turn Off Apex Debug Log for Replay Debugger', async () => {
    logTestStart(testSetup, 'ApexReplayDebugger - SFDX: Turn Off Apex Debug Log for Replay Debugger');

    // Run SFDX: Turn Off Apex Debug Log for Replay Debugger
    await clearOutputView();
    prompt = await executeQuickPick('SFDX: Turn Off Apex Debug Log for Replay Debugger', Duration.seconds(1));

    // Look for the success notification that appears which says, "SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran".
    await verifyNotificationWithRetry(
      /SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran/,
      Duration.TEN_MINUTES
    );

    // Verify content on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Turn Off Apex Debug Log for Replay Debugger',
      10
    );
    expect(outputPanelText).to.contain('Ended SFDX: Turn Off Apex Debug Log for Replay Debugger');
  });

  after('Tear down and clean up the testing environment', async () => {
    log('ApexReplayDebugger - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
