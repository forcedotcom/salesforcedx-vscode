/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestSetup } from '../testSetup';
import * as utilities from '../utilities/index';
import { EnvironmentSettings } from '../environmentSettings';
import { By, InputBox, WebElement, after } from 'vscode-extension-tester';
import path from 'path';
import fs from 'fs';
import { step } from 'mocha-steps';
import { expect } from 'chai';

// Types
interface LspStatus {
  indexingComplete: string;
  restarting: string;
  preludeStarting: string;
}

interface LspRestartOptions {
  cleanDb: boolean;
  option: string;
}

// Constants
const PATHS = {
  project: path.join(__dirname, '..', '..', 'e2e-temp', 'TempProject-ApexLsp'),
  apexClass: path.join(
    __dirname,
    '..',
    '..',
    'e2e-temp',
    'TempProject-ApexLsp',
    'force-app',
    'main',
    'default',
    'classes'
  ),
  tools: path.join(__dirname, '..', '..', 'e2e-temp', 'TempProject-ApexLsp', '.sfdx', 'tools')
} as const;

const LSP_STATUS: LspStatus = {
  indexingComplete: 'Indexing complete',
  restarting: 'Apex Language Server is restarting',
  preludeStarting: 'Apex Prelude Service STARTING'
} as const;

const LSP_RESTART_OPTIONS: LspRestartOptions[] = [
  { cleanDb: false, option: 'Restart Only' },
  { cleanDb: true, option: 'Clean Apex DB and Restart' }
] as const;

// Helper Functions
const findReleaseDir = (): string => {
  const entries = fs.readdirSync(PATHS.tools);
  const match = entries.find(entry => /^\d{3}$/.test(entry));
  return match || '254';
};

const verifyLspStatus = async (expectedStatus: string): Promise<WebElement> => {
  const statusBar = await utilities.getStatusBarItemWhichIncludes('Editor Language Status');
  await statusBar.click();
  const ariaLabel = await statusBar.getAttribute('aria-label');
  expect(ariaLabel).to.include(expectedStatus);
  return statusBar;
};

const verifyLspRestart = async (cleanDb: boolean): Promise<void> => {
  const option = LSP_RESTART_OPTIONS.find(opt => opt.cleanDb === cleanDb)?.option;
  if (!option) throw new Error(`Invalid cleanDb option: ${cleanDb}`);
  // Wait for LSP to enter restarting state
  await verifyLspStatus(LSP_STATUS.restarting);
  // Allow time for LSP to fully restart and reindex
  await utilities.pause(utilities.Duration.seconds(12));
  await verifyLspStatus(LSP_STATUS.indexingComplete);

  const outputViewText = await utilities.getOutputViewText('Apex Language Server');
  expect(outputViewText).to.contain(LSP_STATUS.preludeStarting);
};

const setupTestEnvironment = async (testSetup: TestSetup): Promise<void> => {
  utilities.log('ApexLsp - Set up the testing environment');
  utilities.log(`ApexLsp - JAVA_HOME: ${EnvironmentSettings.getInstance().javaHome}`);
  // Allow time for VSCode to fully initialize and load extensions
  await utilities.pause(utilities.Duration.seconds(10));
  await utilities.createApexClassWithTest('ExampleClass');
};

const verifyIndexing = async (testSetup: TestSetup): Promise<void> => {
  utilities.log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);
  const workbench = utilities.getWorkbench();
  await utilities.getTextEditor(workbench, 'ExampleClass.cls');

  const statusBar = await verifyLspStatus(LSP_STATUS.indexingComplete);
  const outputViewText = await utilities.getOutputViewText('Apex Language Server');
  utilities.log(`Output view text: ${outputViewText}`);
};

const testGoToDefinition = async (testSetup: TestSetup): Promise<void> => {
  utilities.log(`${testSetup.testSuiteSuffixName} - Go to Definition`);
  const workbench = utilities.getWorkbench();
  const textEditor = await utilities.getTextEditor(workbench, 'ExampleClassTest.cls');

  await textEditor.moveCursor(6, 20);
  // Allow time for LSP to process cursor movement and prepare definition lookup
  await utilities.pause(utilities.Duration.seconds(2));
  // Wait for quick pick to appear and be clickable
  await utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(3));

  const editorView = workbench.getEditorView();
  const activeTab = await editorView.getActiveTab();
  const title = await activeTab?.getTitle();
  expect(title).to.equal('ExampleClass.cls');
};

const testAutocompletion = async (testSetup: TestSetup): Promise<void> => {
  utilities.log(`${testSetup.testSuiteSuffixName} - Autocompletion`);
  const workbench = utilities.getWorkbench();
  const textEditor = await utilities.getTextEditor(workbench, 'ExampleClassTest.cls');

  await textEditor.typeTextAt(7, 1, '\tExampleClass.say');
  // Allow time for LSP to process text input and prepare autocompletion suggestions
  await utilities.pause(utilities.Duration.seconds(2));

  const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
  const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
  expect(ariaLabel).to.contain('SayHello(name)');

  await autocompletionOptions[0].click();
  await textEditor.typeText(`'Jack`);
  await textEditor.typeTextAt(7, 38, ';');
  await textEditor.save();

  // Allow time for LSP to process the changes and update the editor
  await utilities.pause(utilities.Duration.seconds(2));
  const line7Text = await textEditor.getTextAtLine(7);
  expect(line7Text).to.include(`ExampleClass.SayHello('Jack');`);
};

const testLspRestart = async (testSetup: TestSetup, cleanDb: boolean): Promise<void> => {
  const action = cleanDb ? 'with cleaned db' : 'alone';
  utilities.log(`${testSetup.testSuiteSuffixName} - Cmd Palette: LSP Restart ${action}`);

  if (cleanDb) {
    const releaseDir = findReleaseDir();
    const standardApexLibraryPath = path.join(PATHS.tools, releaseDir, 'StandardApexLibrary');
    await utilities.removeFolder(standardApexLibraryPath);
    expect(await utilities.getFolderName(standardApexLibraryPath)).to.equal(null);
  }

  const restartCommand = await utilities.executeQuickPick('Restart Apex Language Server');
  const quickPicks = await restartCommand.getQuickPicks();
  for (const quickPick of quickPicks) {
    const label = await quickPick.getLabel();
    if (label === (cleanDb ? 'Clean Apex DB and Restart' : 'Restart Only')) {
      await quickPick.select();
      break;
    }
  }
  await verifyLspRestart(cleanDb);

  if (cleanDb) {
    const releaseDir = findReleaseDir();
    expect(await utilities.getFolderName(path.join(PATHS.tools, releaseDir, 'StandardApexLibrary'))).to.equal(
      'StandardApexLibrary'
    );
  }
};

const testStatusBarRestart = async (testSetup: TestSetup, cleanDb: boolean): Promise<void> => {
  const action = cleanDb ? 'with cleaned db' : 'alone';
  utilities.log(`${testSetup.testSuiteSuffixName} - Apex Status Bar: LSP Restart ${action}`);

  const statusBar = await utilities.getStatusBarItemWhichIncludes('Editor Language Status');
  await statusBar.click();

  // Allow time for status bar menu to appear and be clickable
  await utilities.pause(utilities.Duration.seconds(3));
  const restartButton = utilities.getWorkbench().findElement(By.linkText('Restart Apex Language Server'));
  await restartButton.click();

  // Allow time for restart process to begin
  const dropdown = await new InputBox().wait();
  await utilities.selectQuickPickItem(dropdown, cleanDb ? 'Clean Apex DB and Restart' : 'Restart Only');
  await verifyLspRestart(cleanDb);

  if (cleanDb) {
    const releaseDir = findReleaseDir();
    expect(await utilities.getFolderName(path.join(PATHS.tools, releaseDir, 'StandardApexLibrary'))).to.equal(
      'StandardApexLibrary'
    );
  }
};

describe('Apex LSP', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'ApexLsp'
  };

  step('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
    await setupTestEnvironment(testSetup);
  });

  step('Verify LSP finished indexing', async () => {
    await verifyIndexing(testSetup);
  });

  step('Go to Definition', async () => {
    await testGoToDefinition(testSetup);
  });

  step('Autocompletion', async () => {
    await testAutocompletion(testSetup);
  });

  step('Restart LSP alone via Command Palette', async () => {
    await testLspRestart(testSetup, false);
  });

  step('Restart LSP with cleaned db via Command Palette', async () => {
    await testLspRestart(testSetup, true);
  });

  step('Verify LSP can restart alone via Status Bar', async () => {
    await testStatusBarRestart(testSetup, false);
  });

  step('Verify LSP can restart with cleaned db via Status Bar', async () => {
    await testStatusBarRestart(testSetup, true);
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await utilities.removeFolder(PATHS.apexClass);
    await testSetup?.tearDown();
  });
});
