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
import { EnvironmentSettings } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/environmentSettings';
import { retryOperation } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import { createApexClassWithTest } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { getFolderName, removeFolder } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  getWorkbench,
  getStatusBarItemWhichIncludes,
  getTextEditor,
  getOutputViewText,
  moveCursorWithFallback
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import {
  executeQuickPick,
  selectQuickPickItem
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction/commandPrompt';
import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { By, InputBox, WebElement, after } from 'vscode-extension-tester';
import { logTestStart } from '../utils/loggingHelper';

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
  project: path.join(__dirname, '..', '..', '..', '..', '..', 'e2e-temp', 'TempProject-ApexLsp'),
  apexClass: path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'e2e-temp',
    'TempProject-ApexLsp',
    'force-app',
    'main',
    'default',
    'classes'
  ),
  tools: path.join(__dirname, '..', '..', '..', '..', '..', 'e2e-temp', 'TempProject-ApexLsp', '.sfdx', 'tools')
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
  return match ?? '254';
};

const verifyLspStatus = async (expectedStatus: string): Promise<WebElement> => {
  const statusBar = await getStatusBarItemWhichIncludes('Editor Language Status');
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
  await pause(Duration.seconds(25));
  await verifyLspStatus(LSP_STATUS.indexingComplete);

  const outputViewText = await getOutputViewText('Apex Language Server');
  expect(outputViewText).to.contain(LSP_STATUS.preludeStarting);
};

const setupTestEnvironment = async (): Promise<void> => {
  log('ApexLsp - Set up the testing environment');
  log(`ApexLsp - JAVA_HOME: ${EnvironmentSettings.getInstance().javaHome}`);
  // Allow time for VSCode to fully initialize and load extensions
  await pause(Duration.seconds(10));
  await createApexClassWithTest('ExampleClass', PATHS.apexClass);
};

const verifyIndexing = async (testSetup: TestSetup): Promise<void> => {
  logTestStart(testSetup, 'Verify LSP finished indexing');
  const workbench = getWorkbench();
  await getTextEditor(workbench, 'ExampleClass.cls');

  await verifyLspStatus(LSP_STATUS.indexingComplete);
  const outputViewText = await getOutputViewText('Apex Language Server');
  log(`Output view text: ${outputViewText}`);
};

const testGoToDefinition = async (testSetup: TestSetup): Promise<void> => {
  logTestStart(testSetup, 'Go to Definition');
  const workbench = getWorkbench();
  await retryOperation(async () => {
    const textEditor = await getTextEditor(workbench, 'ExampleClassTest.cls');
    await pause(Duration.seconds(2));
    await moveCursorWithFallback(textEditor, 6, 20);

    // Allow time for LSP to process cursor movement and prepare definition lookup
    await pause(Duration.seconds(2));
    // Wait for quick pick to appear and be clickable
    await executeQuickPick('Go to Definition', Duration.seconds(3));

    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('ExampleClass.cls');
  }, 3, 'Go to Definition - Error switching to ExampleClass.cls');
};

const testAutocompletion = async (testSetup: TestSetup): Promise<void> => {
  logTestStart(testSetup, 'Autocompletion');
  const workbench = getWorkbench();
  const textEditor = await getTextEditor(workbench, 'ExampleClassTest.cls');

  await textEditor.typeTextAt(7, 1, '\tExampleClass.say');
  // Allow time for LSP to process text input and prepare autocompletion suggestions
  await pause(Duration.seconds(2));

  const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
  const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
  expect(ariaLabel).to.contain('SayHello(name)');

  await autocompletionOptions[0].click();
  await textEditor.typeText("'Jack");
  await textEditor.typeTextAt(7, 38, ';');
  await textEditor.save();

  // Allow time for LSP to process the changes and update the editor
  await pause(Duration.seconds(2));
  const line7Text = await textEditor.getTextAtLine(7);
  expect(line7Text).to.include("ExampleClass.SayHello('Jack');");
};

const testLspRestart = async (testSetup: TestSetup, cleanDb: boolean): Promise<void> => {
  const action = cleanDb ? 'with cleaned db' : 'alone';
  logTestStart(testSetup, `Cmd Palette: LSP Restart ${action}`);

  if (cleanDb) {
    const releaseDir = findReleaseDir();
    const standardApexLibraryPath = path.normalize(path.join(PATHS.tools, releaseDir, 'StandardApexLibrary'));
    removeFolder(standardApexLibraryPath);
    expect(getFolderName(standardApexLibraryPath)).to.equal(null);
  }

  const restartCommand = await executeQuickPick('Restart Apex Language Server');
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
    const standardApexLibraryPath = path.normalize(path.join(PATHS.tools, releaseDir, 'StandardApexLibrary'));
    expect(getFolderName(standardApexLibraryPath)).to.equal('StandardApexLibrary');
  }
};

const testStatusBarRestart = async (testSetup: TestSetup, cleanDb: boolean): Promise<void> => {
  const action = cleanDb ? 'with cleaned db' : 'alone';
  logTestStart(testSetup, `Apex Status Bar: LSP Restart ${action}`);

  const statusBar = await getStatusBarItemWhichIncludes('Editor Language Status');
  await statusBar.click();

  // Allow time for status bar menu to appear and be clickable
  await pause(Duration.seconds(3));
  const restartButton = getWorkbench().findElement(By.linkText('Restart Apex Language Server'));
  await restartButton.click();

  // Allow time for restart process to begin
  const dropdown = await new InputBox().wait();
  await selectQuickPickItem(dropdown, cleanDb ? 'Clean Apex DB and Restart' : 'Restart Only');
  await verifyLspRestart(cleanDb);

  if (cleanDb) {
    const releaseDir = findReleaseDir();
    expect(getFolderName(path.join(PATHS.tools, releaseDir, 'StandardApexLibrary'))).to.equal('StandardApexLibrary');
  }
};

describe('Apex LSP', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'ApexLsp'
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
    await setupTestEnvironment();
  });

  beforeEach(function () {
    if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
      this.skip();
    }
  });

  it('Verify LSP finished indexing', async () => {
    await verifyIndexing(testSetup);
  });

  it('Go to Definition', async () => {
    await testGoToDefinition(testSetup);
  });

  it('Autocompletion', async () => {
    await testAutocompletion(testSetup);
  });

  it('Restart LSP alone via Command Palette', async () => {
    await testLspRestart(testSetup, false);
  });

  it('Restart LSP with cleaned db via Command Palette', async () => {
    await testLspRestart(testSetup, true);
  });

  it('Verify LSP can restart alone via Status Bar', async () => {
    await testStatusBarRestart(testSetup, false);
  });

  it('Verify LSP can restart with cleaned db via Status Bar', async () => {
    await testStatusBarRestart(testSetup, true);
  });

  after('Tear down and clean up the testing environment', async () => {
    log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    removeFolder(PATHS.apexClass);
    await testSetup?.tearDown();
  });
});
