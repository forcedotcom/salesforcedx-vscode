/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  createCommand,
  Duration,
  log,
  pause,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { verifyNotificationWithRetry } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import { runCliCommand } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  attemptToFindOutputPanelText,
  clearOutputView,
  executeQuickPick,
  getTextEditor,
  getWorkbench,
  overrideTextInFile,
  reloadWindow
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { after } from 'vscode-extension-tester';
import { logTestStart } from '../utils/loggingHelper';

describe('Push and Pull', () => {
  let testSetup1: TestSetup;
  let testSetup2: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'PushAndPull'
  };

  before('Set up the testing environment', async () => {
    log('Push And Pull - Set up the testing environment');
    testSetup1 = await TestSetup.setUp(testReqConfig);
  });

  beforeEach(function () {
    if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
      this.skip();
    }
  });

  it('SFDX: View All Changes (Local and in Default Org)', async () => {
    logTestStart(testSetup1, 'Push And Pull - SFDX: View All Changes (Local and in Default Org)');
    await executeQuickPick('SFDX: View All Changes (Local and in Default Org)', Duration.seconds(5));

    // Check the output.
    const outputPanelText = await attemptToFindOutputPanelText('Salesforce CLI', 'Source Status', 10);
    expect(outputPanelText).to.contain('No local or remote changes found');
  });

  it('Create an Apex class', async () => {
    logTestStart(testSetup1, 'Push And Pull - Create an Apex class');
    // Create an Apex Class.
    await createCommand('Apex Class', 'ExampleApexClass1', 'classes', 'cls');
  });

  it('SFDX: View Local Changes', async () => {
    logTestStart(testSetup1, 'Push And Pull - SFDX: View Local Changes');
    await executeQuickPick('SFDX: View Local Changes', Duration.seconds(5));

    // Check the output.
    const outputPanelText = await attemptToFindOutputPanelText('Salesforce CLI', 'Source Status', 10);
    expect(outputPanelText).to.contain(
      `Local Add  ExampleApexClass1  ApexClass  ${path.join('force-app', 'main', 'default', 'classes', 'ExampleApexClass1.cls')}`
    );
    expect(outputPanelText).to.contain(
      `Local Add  ExampleApexClass1  ApexClass  ${path.join('force-app', 'main', 'default', 'classes', 'ExampleApexClass1.cls-meta.xml')}`
    );
  });

  it('Push the Apex class', async () => {
    logTestStart(testSetup1, 'Push And Pull - Push the Apex class');
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(5));

    await verifyPushSuccess();
    // Check the output.
    await verifyPushAndPullOutputText('Push', 'to', 'Created');
  });

  it('Push again (with no changes)', async () => {
    logTestStart(testSetup1, 'Push And Pull - Push again (with no changes)');
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));

    // Now push
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(5));

    await verifyPushSuccess();
    // Check the output.
    await verifyPushAndPullOutputText('Push', 'to');
  });

  it('Modify the file and push the changes', async () => {
    logTestStart(testSetup1, 'Push And Pull - Modify the file and push the changes');
    const newText = `public with sharing class ExampleApexClass1 {
      public ExampleApexClass1() {
          // sample comment
      }
    }`;

    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));

    // Modify the file by adding a comment.
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClass1.cls');

    // Wait for editor to stabilize before continuing
    await pause(Duration.seconds(1));

    // Push the file.
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(5));

    await verifyPushSuccess();
    // Check the output.
    await verifyPushAndPullOutputText('Push', 'to');

    // Clear the Output view again.
    await clearOutputView(Duration.seconds(2));

    // Don't save the file just yet.
    await overrideTextInFile(textEditor, newText, false);

    // An now push the changes.
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(5));

    await verifyPushSuccess();
    // Check the output.
    const outputPanelText = await verifyPushAndPullOutputText('Push', 'to', 'Changed');

    expect(outputPanelText).to.contain(
      path.join(
        'e2e-temp',
        'TempProject-PushAndPull',
        'force-app',
        'main',
        'default',
        'classes',
        'ExampleApexClass1.cls'
      )
    );
    expect(outputPanelText).to.contain(
      path.join(
        'e2e-temp',
        'TempProject-PushAndPull',
        'force-app',
        'main',
        'default',
        'classes',
        'ExampleApexClass1.cls-meta.xml'
      )
    );
  });

  it('Pull the Apex class', async () => {
    logTestStart(testSetup1, 'Push And Pull - Pull the Apex class');
    // With this test, it's going to pull twice...
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));

    await executeQuickPick('SFDX: Pull Source from Default Org', Duration.seconds(5));
    // At this point there should be no conflicts since there have been no changes.
    await verifyPullSuccess();
    // Check the output.
    let outputPanelText = await verifyPushAndPullOutputText('Pull', 'from', 'Created');
    // The first time a pull is performed, force-app/main/default/profiles/Admin.profile-meta.xml is pulled down.
    expect(outputPanelText).to.contain(path.join('force-app', 'main', 'default', 'profiles', 'Admin.profile-meta.xml'));

    // Second pull...
    // Clear the output again.
    await clearOutputView(Duration.seconds(2));

    // And pull again.
    await executeQuickPick('SFDX: Pull Source from Default Org', Duration.seconds(5));
    await verifyPullSuccess();
    // Check the output.
    outputPanelText = await verifyPushAndPullOutputText('Pull', 'from');
    expect(outputPanelText).to.not.contain('Created  Admin');
  });

  it("Modify the file (but don't save), then pull", async () => {
    logTestStart(testSetup1, "Push And Pull - Modify the file (but don't save), then pull");
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));

    // Modify the file by adding a comment.
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClass1.cls');
    const newText = `public with sharing class ExampleApexClass1 {
      public ExampleApexClass1() {
          // sample comment for the pull test
      }
    }`;
    // Don't save the file just yet.
    await overrideTextInFile(textEditor, newText, false);

    // Wait for editor to stabilize before continuing
    await pause(Duration.seconds(1));

    // Pull the file.
    await executeQuickPick('SFDX: Pull Source from Default Org', Duration.seconds(5));
    await verifyPullSuccess();
    // Check the output.
    await verifyPushAndPullOutputText('Pull', 'from');
  });

  it('Save the modified file, then pull', async () => {
    logTestStart(testSetup1, 'Push And Pull - Save the modified file, then pull');
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));

    // Now save the file.
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClass1.cls');
    await textEditor.save();

    // And now pull the changes.
    await executeQuickPick('SFDX: Pull Source from Default Org', Duration.seconds(5));
    await verifyPullSuccess();
    // Check the output.
    await verifyPushAndPullOutputText('Pull', 'from');
  });

  const testReqConfig2: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'ViewChanges'
  };

  it('SFDX: View Changes in Default Org', async () => {
    log('Push And Pull - SFDX: View Changes in Default Org');
    // Create second Project to then view Remote Changes
    // The new project will connect to the scratch org automatically on GHA, but does not work locally
    testSetup2 = await TestSetup.setUp(testReqConfig2);
    await runCliCommand('config set', `target-org=${testSetup1.scratchOrgAliasName}`);

    // Run SFDX: View Changes in Default Org command to view remote changes
    await executeQuickPick('SFDX: View Changes in Default Org', Duration.seconds(5));

    // Reload window to update cache
    await reloadWindow(Duration.seconds(20));

    // Run SFDX: View Changes in Default Org command to view remote changes
    await executeQuickPick('SFDX: View Changes in Default Org', Duration.seconds(5));

    // Check the output.
    const outputPanelText = await attemptToFindOutputPanelText('Salesforce CLI', 'Source Status', 10);
    expect(outputPanelText).to.contain('Remote Add  ExampleApexClass1  ApexClass');
  });

  // TODO: at this point write e2e tests for conflict detection
  // but there's a bug - when the 2nd user is created the code thinks
  // it's a source tracked org and push & pull are no longer available
  // (yet deploy & retrieve are).  Spoke with Ken and we think this will
  // be fixed with the check in of his PR this week.

  after('Tear down and clean up the testing environment', async () => {
    log('Push and Pull - Tear down and clean up the testing environment');
    await testSetup1?.tearDown(false);
    await testSetup2?.tearDown();
  });
});

/**
 * @param operation identifies if it's a pull or push operation
 * @param fromTo indicates if changes are coming from or going to the org
 * @param type indicates if the metadata is expected to have been created, changed or deleted
 * @returns the output panel text after
 */
const verifyPushAndPullOutputText = async (
  operation: string,
  fromTo: string,
  type?: string
): Promise<string | undefined> => {
  await verifyNotificationWithRetry(
    new RegExp(`SFDX: ${operation} Source ${fromTo} Default Org successfully ran`),
    Duration.TEN_MINUTES
  );
  // Check the output.
  const outputPanelText = await attemptToFindOutputPanelText('Salesforce CLI', `=== ${operation}ed Source`, 10);

  log(`outputPanelText: ${outputPanelText}`);
  if (type) {
    if (operation === 'Push') {
      expect(outputPanelText).to.contain(`${type}  ExampleApexClass1  ApexClass`);
    } else {
      expect(outputPanelText).to.contain(`${type}  Admin`);
    }
  } else {
    expect(outputPanelText).to.contain('No results found');
  }
  expect(outputPanelText).to.contain('ended with exit code 0');
  return outputPanelText;
};

const verifyPushSuccess = async (wait = Duration.TEN_MINUTES) => {
  await verifyNotificationWithRetry(/SFDX: Push Source to Default Org successfully ran/, wait);
};

const verifyPullSuccess = async (wait = Duration.TEN_MINUTES) => {
  await verifyNotificationWithRetry(/SFDX: Pull Source from Default Org successfully ran/, wait);
};
