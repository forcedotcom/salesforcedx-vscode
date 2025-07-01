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
  waitForNotificationToGoAway
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { InputBox, QuickOpenBox, TextEditor } from 'vscode-extension-tester';

describe('Apex Replay Debugger', () => {
  let prompt: QuickOpenBox | InputBox;
  let testSetup: TestSetup;
  let projectFolderPath: string;
  let logFileTitle: string;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'ApexReplayDebugger'
  };

  before('Set up the testing environment', async () => {
    log('ApexReplayDebugger - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    projectFolderPath = testSetup.projectFolderPath!;

    // Create Apex class file
    await createApexClassWithTest('ExampleApexClass');

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', Duration.seconds(1));

    await verifyNotificationWithRetry(
      /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
      Duration.TEN_MINUTES
    );
  });

  // Since tests are sequential, we need to skip the rest of the tests if one fails
  beforeEach(function () {
    if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
      this.skip();
    }
  });

  it('Verify LSP finished indexing', async () => {
    log('ApexReplayDebugger - Verify LSP finished indexing');

    // Get Apex LSP Status Bar
    const statusBar = await retryOperation(async () => await getStatusBarItemWhichIncludes('Editor Language Status'));
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
  });

  it('SFDX: Turn On Apex Debug Log for Replay Debugger', async () => {
    log('ApexReplayDebugger - SFDX: Turn On Apex Debug Log for Replay Debugger');

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
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('SFDX: Turn On Apex Debug Log for Replay Debugger');
    expect(outputPanelText).to.contain('ended with exit code 0');
  });

  it('Run the Anonymous Apex Debugger with Currently Selected Text', async () => {
    log('ApexReplayDebugger - Run the Anonymous Apex Debugger with Currently Selected Text');

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
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('Compiled successfully.');
    expect(outputPanelText).to.contain('Executed successfully.');
    expect(outputPanelText).to.contain('|EXECUTION_STARTED');
    expect(outputPanelText).to.contain('|EXECUTION_FINISHED');
    expect(outputPanelText).to.contain('ended Execute Anonymous Apex');
  });

  it('SFDX: Get Apex Debug Logs', async () => {
    log('ApexReplayDebugger - SFDX: Get Apex Debug Logs');

    // Run SFDX: Get Apex Debug Logs
    const workbench = getWorkbench();
    await clearOutputView();
    await pause(Duration.seconds(2));
    prompt = await executeQuickPick('SFDX: Get Apex Debug Logs', Duration.seconds(0));

    // Wait for the command to execute
    await waitForNotificationToGoAway(/Getting Apex debug logs/, Duration.TEN_MINUTES);
    await pause(Duration.seconds(2));

    // Select a log file
    const quickPicks = await prompt.getQuickPicks();
    expect(quickPicks).to.not.be.undefined;
    expect(quickPicks.length).to.be.greaterThanOrEqual(0);
    await prompt.selectQuickPick('User User - Api');

    await verifyNotificationWithRetry(/SFDX: Get Apex Debug Logs successfully ran/, Duration.TEN_MINUTES);

    // Verify content on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText('Apex', 'Starting SFDX: Get Apex Debug Logs', 10);
    expect(outputPanelText).to.not.be.undefined;
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
    expect(executionStarted).to.be.greaterThanOrEqual(1);
    expect(executionFinished).to.be.greaterThanOrEqual(1);
  });

  it('SFDX: Launch Apex Replay Debugger with Last Log File', async () => {
    log('ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Last Log File');

    // Get open text editor
    const workbench = getWorkbench();
    const editorView = workbench.getEditorView();

    // Get file path from open text editor
    const activeTab = await editorView.getActiveTab();
    expect(activeTab).to.not.be.undefined;
    const title = await activeTab?.getTitle();
    if (title) logFileTitle = title;
    const logFilePath = path.join(projectFolderPath, '.sfdx', 'tools', 'debug', 'logs', logFileTitle);
    console.log('*** logFilePath = ' + logFilePath);

    // Run SFDX: Launch Apex Replay Debugger with Last Log File
    prompt = await executeQuickPick('SFDX: Launch Apex Replay Debugger with Last Log File', Duration.seconds(1));
    await prompt.setText(logFilePath);
    await prompt.confirm();
    await pause();

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  it('SFDX: Launch Apex Replay Debugger with Current File - log file', async () => {
    log('ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Current File - log file');

    const workbench = getWorkbench();
    await getTextEditor(workbench, logFileTitle);

    // Run SFDX: Launch Apex Replay Debugger with Current File
    await executeQuickPick('SFDX: Launch Apex Replay Debugger with Current File', Duration.seconds(3));

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  it('SFDX: Launch Apex Replay Debugger with Current File - test class', async () => {
    log('ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Current File - test class');

    // Run SFDX: Launch Apex Replay Debugger with Current File
    const workbench = getWorkbench();
    await getTextEditor(workbench, 'ExampleApexClassTest.cls');
    await executeQuickPick('SFDX: Launch Apex Replay Debugger with Current File', Duration.seconds(10));

    // Continue with the debug session
    await continueDebugging(2, 30);

    await verifyNotificationWithRetry(/Debug Test\(s\) successfully ran/, Duration.TEN_MINUTES);
  });

  it('Run the Anonymous Apex Debugger using the Command Palette', async () => {
    log('ApexReplayDebugger - Run the Anonymous Apex Debugger using the Command Palette');

    // Clear output before running the command
    await clearOutputView();

    // Create anonymous apex file
    await createAnonymousApexFile();

    // Run SFDX: Launch Apex Replay Debugger with Editor Contents", using the Command Palette.
    await executeQuickPick('SFDX: Execute Anonymous Apex with Editor Contents', Duration.seconds(10));

    await verifyNotificationWithRetry(/Execute Anonymous Apex successfully ran/, Duration.TEN_MINUTES);

    // Verify content on vscode's Output section
    const outputPanelText = await attemptToFindOutputPanelText('Apex', 'Starting Execute Anonymous Apex', 10);
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('Compiled successfully.');
    expect(outputPanelText).to.contain('Executed successfully.');
    expect(outputPanelText).to.contain('|EXECUTION_STARTED');
    expect(outputPanelText).to.contain('|EXECUTION_FINISHED');
    expect(outputPanelText).to.contain('ended Execute Anonymous Apex');
  });

  it('SFDX: Turn Off Apex Debug Log for Replay Debugger', async () => {
    log('ApexReplayDebugger - SFDX: Turn Off Apex Debug Log for Replay Debugger');

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
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('ended with exit code 0');
  });

  after('Tear down and clean up the testing environment', async () => {
    log('ApexReplayDebugger - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
