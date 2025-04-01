/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { step } from 'mocha-steps';
import path from 'path';
import { TestSetup } from 'salesforcedx-vscode-automation-tests-redhat/test/testSetup';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { InputBox, QuickOpenBox, TextEditor } from 'vscode-extension-tester';

describe('Apex Replay Debugger', async () => {
  let prompt: QuickOpenBox | InputBox;
  let testSetup: TestSetup;
  let projectFolderPath: string;
  let logFileTitle: string;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'ApexReplayDebugger'
  };

  step('Set up the testing environment', async () => {
    utilities.log('ApexReplayDebugger - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    projectFolderPath = testSetup.projectFolderPath!;

    // Create Apex class file
    await utilities.createApexClassWithTest('ExampleApexClass');

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
    utilities.log('ApexReplayDebugger - Verify LSP finished indexing');

    // Get Apex LSP Status Bar
    const statusBar = await utilities.getStatusBarItemWhichIncludes('Editor Language Status');
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
  });

  step('SFDX: Turn On Apex Debug Log for Replay Debugger', async () => {
    utilities.log('ApexReplayDebugger - SFDX: Turn On Apex Debug Log for Replay Debugger');

    // Clear output before running the command
    await utilities.clearOutputView();

    // Run SFDX: Turn On Apex Debug Log for Replay Debugger
    await utilities.executeQuickPick(
      'SFDX: Turn On Apex Debug Log for Replay Debugger',
      utilities.Duration.seconds(10)
    );

    // Look for the success notification that appears which says, "SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await utilities.getWorkbench().openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

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

  step('Run the Anonymous Apex Debugger with Currently Selected Text', async () => {
    utilities.log('ApexReplayDebugger - Run the Anonymous Apex Debugger with Currently Selected Text');

    // Clear output before running the command
    await utilities.clearOutputView();

    // Get open text editor
    const workbench = utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'ExampleApexClassTest.cls');

    // Select text
    const findWidget = await textEditor.openFindWidget();
    await findWidget.setSearchText("ExampleApexClass.SayHello('Cody');");
    await utilities.pause(utilities.Duration.seconds(1));
    // Close finder tool
    await findWidget.close();
    await utilities.pause(utilities.Duration.seconds(1));

    // Run SFDX: Launch Apex Replay Debugger with Currently Selected Text.
    await utilities.executeQuickPick(
      'SFDX: Execute Anonymous Apex with Currently Selected Text',
      utilities.Duration.seconds(1)
    );

    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /Execute Anonymous Apex successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    // Verify content on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', 'Starting Execute Anonymous Apex', 10);
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('Compiled successfully.');
    expect(outputPanelText).to.contain('Executed successfully.');
    expect(outputPanelText).to.contain('|EXECUTION_STARTED');
    expect(outputPanelText).to.contain('|EXECUTION_FINISHED');
    expect(outputPanelText).to.contain('ended Execute Anonymous Apex');
  });

  step('SFDX: Get Apex Debug Logs', async () => {
    utilities.log('ApexReplayDebugger - SFDX: Get Apex Debug Logs');

    // Run SFDX: Get Apex Debug Logs
    const workbench = utilities.getWorkbench();
    await utilities.clearOutputView();
    await utilities.pause(utilities.Duration.seconds(2));
    prompt = await utilities.executeQuickPick('SFDX: Get Apex Debug Logs', utilities.Duration.seconds(0));

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(/Getting Apex debug logs/, utilities.Duration.TEN_MINUTES);
    await utilities.pause(utilities.Duration.seconds(2));

    // Select a log file
    const quickPicks = await prompt.getQuickPicks();
    expect(quickPicks).to.not.be.undefined;
    expect(quickPicks.length).to.be.greaterThanOrEqual(0);
    await prompt.selectQuickPick('User User - Api');

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
    expect(executionStarted).to.be.greaterThanOrEqual(1);
    expect(executionFinished).to.be.greaterThanOrEqual(1);
  });

  step('SFDX: Launch Apex Replay Debugger with Last Log File', async () => {
    utilities.log('ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Last Log File');

    // Get open text editor
    const workbench = utilities.getWorkbench();
    const editorView = workbench.getEditorView();

    // Get file path from open text editor
    const activeTab = await editorView.getActiveTab();
    expect(activeTab).to.not.be.undefined;
    const title = await activeTab?.getTitle();
    if (title) logFileTitle = title;
    const logFilePath = path.join(projectFolderPath, '.sfdx', 'tools', 'debug', 'logs', logFileTitle);
    console.log('*** logFilePath = ' + logFilePath);

    // Run SFDX: Launch Apex Replay Debugger with Last Log File
    prompt = await utilities.executeQuickPick(
      'SFDX: Launch Apex Replay Debugger with Last Log File',
      utilities.Duration.seconds(1)
    );
    await prompt.setText(logFilePath);
    await prompt.confirm();
    await utilities.pause();

    // Continue with the debug session
    await utilities.continueDebugging(2, 30);
  });

  step('SFDX: Launch Apex Replay Debugger with Current File - log file', async () => {
    utilities.log('ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Current File - log file');

    const workbench = utilities.getWorkbench();
    await utilities.getTextEditor(workbench, logFileTitle);

    // Run SFDX: Launch Apex Replay Debugger with Current File
    await utilities.executeQuickPick(
      'SFDX: Launch Apex Replay Debugger with Current File',
      utilities.Duration.seconds(3)
    );

    // Continue with the debug session
    await utilities.continueDebugging(2, 30);
  });

  step('SFDX: Launch Apex Replay Debugger with Current File - test class', async () => {
    utilities.log('ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Current File - test class');

    // Run SFDX: Launch Apex Replay Debugger with Current File
    const workbench = utilities.getWorkbench();
    await utilities.getTextEditor(workbench, 'ExampleApexClassTest.cls');
    await utilities.executeQuickPick(
      'SFDX: Launch Apex Replay Debugger with Current File',
      utilities.Duration.seconds(3)
    );

    // Continue with the debug session
    await utilities.continueDebugging(2, 30);

    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /Debug Test\(s\) successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);
  });

  step('Run the Anonymous Apex Debugger using the Command Palette', async () => {
    utilities.log('ApexReplayDebugger - Run the Anonymous Apex Debugger using the Command Palette');

    // Clear output before running the command
    await utilities.clearOutputView();

    // Create anonymous apex file
    await utilities.createAnonymousApexFile();

    // Run SFDX: Launch Apex Replay Debugger with Editor Contents", using the Command Palette.
    await utilities.executeQuickPick(
      'SFDX: Execute Anonymous Apex with Editor Contents',
      utilities.Duration.seconds(10)
    );

    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /Execute Anonymous Apex successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    // Verify content on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', 'Starting Execute Anonymous Apex', 10);
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('Compiled successfully.');
    expect(outputPanelText).to.contain('Executed successfully.');
    expect(outputPanelText).to.contain('|EXECUTION_STARTED');
    expect(outputPanelText).to.contain('|EXECUTION_FINISHED');
    expect(outputPanelText).to.contain('ended Execute Anonymous Apex');
  });

  step('SFDX: Turn Off Apex Debug Log for Replay Debugger', async () => {
    utilities.log('ApexReplayDebugger - SFDX: Turn Off Apex Debug Log for Replay Debugger');

    // Run SFDX: Turn Off Apex Debug Log for Replay Debugger
    await utilities.clearOutputView();
    prompt = await utilities.executeQuickPick(
      'SFDX: Turn Off Apex Debug Log for Replay Debugger',
      utilities.Duration.seconds(1)
    );

    // Look for the success notification that appears which says, "SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    // Verify content on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Turn Off Apex Debug Log for Replay Debugger',
      10
    );
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('Deleting Record...');
    expect(outputPanelText).to.contain('Success');
    expect(outputPanelText).to.contain('Successfully deleted record:');
    expect(outputPanelText).to.contain('ended with exit code 0');
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log('ApexReplayDebugger - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
