/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  TestReqConfig,
  ProjectShapeOption,
  pause,
  createCommand,
  openFile,
  Duration
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { log } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core/miscellaneous';
import {
  retryOperation,
  verifyNotificationWithRetry
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import {
  createApexClass,
  runAndValidateCommand
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { setSettingValue } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import {
  verifyExtensionsAreRunning,
  getExtensionsToVerifyActive
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  executeQuickPick,
  reloadWindow,
  getWorkbench,
  getStatusBarItemWhichIncludes,
  getTextEditor,
  countProblemsInProblemsTab,
  clearOutputView,
  clickButtonOnModalDialog,
  isCommandAvailable,
  overrideTextInFile,
  zoom,
  zoomReset
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import {
  InputBox,
  QuickOpenBox,
  ExtensionsViewSection,
  ActivityBar,
  after,
  By,
  ExtensionsViewItem,
  DefaultTreeItem
} from 'vscode-extension-tester';
import {
  getIdealCaseManagerOASDoc,
  getSfdxProjectJson,
  getIdealSimpleAccountResourceYaml,
  getIdealSimpleAccountResourceXml
} from '../testData/oasDocs';
import { caseManagerClassText, simpleAccountResourceClassText } from '../testData/sampleClassData';
import { logTestStart } from '../utils/loggingHelper';

describe('Create OpenAPI v3 Specifications', () => {
  let prompt: QuickOpenBox | InputBox;
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'CreateOASDoc'
  };

  before('Set up the testing environment', async () => {
    log('\nCreateOASDoc - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);

    // Set SF_LOG_LEVEL to 'debug' to get the logs in the 'llm_logs' folder when the OAS doc is generated
    await setSettingValue('salesforcedx-vscode-core.SF_LOG_LEVEL', 'debug', true);

    // Set a telemetry tag to distinguish it as an E2E test run
    await setSettingValue('salesforcedx-vscode-core.telemetry-tag', 'e2e-test', true);

    // Use VSCode's modal dialog style instead of Mac's native dialog style
    await setSettingValue('window.dialogStyle', 'custom', false);

    // Disable preview mode for opening editors
    await setSettingValue('workbench.editor.enablePreview', false, false);
    await executeQuickPick('View: Close Editor');
    await reloadWindow();

    // Install A4D extension
    const extensionsView = await (await new ActivityBar().getViewControl('Extensions'))?.openView();
    await pause(Duration.seconds(5));
    const extensionsList = await extensionsView?.getContent().getSection('Installed');
    if (!(extensionsList instanceof ExtensionsViewSection)) {
      throw new Error(`Expected ExtensionsViewSection but got different section type: ${typeof extensionsList}`);
    }
    const a4dExtension = await extensionsList?.findItem('Agentforce for Developers');
    await a4dExtension?.install();
    await executeQuickPick('View: Close Editor');

    // Create the Apex class which the decomposed OAS doc will be generated from
    await retryOperation(
      () => createApexClass('CaseManager', caseManagerClassText),
      2,
      'CreateOASDoc - Error creating Apex class CaseManager'
    );

    // Create the Apex class which the composed OAS doc will be generated from
    await retryOperation(
      () => createApexClass('SimpleAccountResource', simpleAccountResourceClassText),
      2,
      'CreateOASDoc - Error creating Apex class SimpleAccountResource'
    );

    // Create an ineligible Apex class (the default Apex class from the template is a good example)
    await retryOperation(
      () => createCommand('Apex Class', 'IneligibleApexClass', 'classes', 'cls'),
      2,
      'CreateOASDoc - Error creating Apex class IneligibleApexClass'
    );

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', Duration.seconds(1));

    await verifyNotificationWithRetry(
      /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
      Duration.TEN_MINUTES
    );

    log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);

    // Get Apex LSP Status Bar
    const statusBar = await getStatusBarItemWhichIncludes('Editor Language Status');
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
  });

  it('Try to generate OAS doc from an ineligible Apex class', async () => {
    logTestStart(testSetup, 'Try to generate OAS doc from an ineligible Apex class');
    await openFile(
      path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'IneligibleApexClass.cls')
    );
    if (process.platform === 'win32') {
      await reloadWindow();
      await verifyExtensionsAreRunning(getExtensionsToVerifyActive());
      const workbench = getWorkbench();
      await getTextEditor(workbench, 'IneligibleApexClass.cls');
    } else {
      await pause(Duration.seconds(5));
    }

    await executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');

    await verifyNotificationWithRetry(
      /Failed to create OpenAPI Document: The Apex Class IneligibleApexClass is not valid for OpenAPI document generation\./,
      Duration.TEN_MINUTES
    );
  });

  describe('Composed mode', () => {
    it('Generate OAS doc from a valid Apex class using command palette - Composed mode, initial generation', async () => {
      logTestStart(
        testSetup,
        'Generate OAS doc from a valid Apex class using command palette - Composed mode, initial generation'
      );
      await executeQuickPick('View: Close All Editors');
      await openFile(
        path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'CaseManager.cls')
      );
      await pause(Duration.seconds(5));
      prompt = await executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      await prompt.confirm();

      await verifyNotificationWithRetry(/OpenAPI Document created for class: CaseManager\./);

      // Verify the generated OAS doc is open in the Editor View
      await executeQuickPick('View: Open Last Editor in Group');
      await pause(Duration.seconds(2)); // Allow time for editor to switch
      const workbench = getWorkbench();
      const editorView = workbench.getEditorView();

      await retryOperation(
        async () => {
          const activeTab = await editorView.getActiveTab();
          if (!activeTab) {
            throw new Error('No active tab found');
          }
          const title = await activeTab.getTitle();
          expect(title).to.equal('CaseManager.externalServiceRegistration-meta.xml');
        },
        5,
        'CreateOASDoc - Error waiting for CaseManager tab'
      );
    });

    it('Check for warnings and errors in the Problems Tab', async () => {
      logTestStart(testSetup, 'Check for warnings and errors in the Problems Tab');
      await countProblemsInProblemsTab(0);
    });

    it('Fix the OAS doc to get rid of the problems in the Problems Tab', async () => {
      // NOTE: The "fix" is actually replacing the OAS doc with the ideal solution
      logTestStart(testSetup, 'Fix the OAS doc to get rid of the problems in the Problems Tab');

      const workbench = getWorkbench();
      const textEditor = await getTextEditor(workbench, 'CaseManager.externalServiceRegistration-meta.xml');
      const xmlText = getIdealCaseManagerOASDoc();
      await overrideTextInFile(textEditor, xmlText);
    });

    it('Revalidate the OAS doc', async () => {
      logTestStart(testSetup, 'Revalidate the OAS doc');
      await executeQuickPick('SFDX: Validate OpenAPI Document (Beta)');
      await verifyNotificationWithRetry(
        /Validated OpenAPI Document CaseManager.externalServiceRegistration-meta.xml successfully/
      );

      const problems = await countProblemsInProblemsTab(2);
      expect(await problems[0].getLabel()).to.equal('CaseManager.externalServiceRegistration-meta.xml');
      expect(await problems[1].getLabel()).to.equal('operations.responses.content should be application/json');
    });

    it('Deploy the composed ESR to the org', async () => {
      logTestStart(testSetup, 'Deploy the composed ESR to the org');
      const workbench = getWorkbench();
      // Clear the Output view first.
      await clearOutputView(Duration.seconds(2));
      await getTextEditor(workbench, 'CaseManager.externalServiceRegistration-meta.xml');
      await runAndValidateCommand('Deploy', 'to', 'ST', 'ExternalServiceRegistration', 'CaseManager', 'Created  ');
    });

    it('Generate OAS doc from a valid Apex class using command palette - Composed mode, manual merge', async () => {
      logTestStart(
        testSetup,
        'Generate OAS doc from a valid Apex class using command palette - Composed mode, manual merge'
      );
      await executeQuickPick('View: Close All Editors');
      await openFile(
        path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'CaseManager.cls')
      );
      await pause(Duration.seconds(5));
      prompt = await executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      await prompt.confirm();

      // Click the Manual Merge button on the popup
      await clickButtonOnModalDialog('Manually merge with existing ESR');

      await verifyNotificationWithRetry(
        /A new OpenAPI Document class CaseManager_\d{8}_\d{6} is created for CaseManager\. Manually merge the two files using the diff editor\./
      );

      // Verify the generated OAS doc and the diff editor are both open in the Editor View
      await executeQuickPick('View: Open First Editor in Group');
      const workbench = getWorkbench();
      await executeQuickPick('Explorer: Focus on Open Editors View');
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const openEditorsView = await content.getSection('Open Editors');

      const openTabs = await openEditorsView?.getVisibleItems();
      expect(openTabs?.length).to.equal(3);

      // Locate each tab in the Open Editors View using the selector (there is a bug in vscode-extension-tester)
      const firstTab = await openEditorsView.findElement(By.css('.monaco-list-row:nth-child(1)'));
      const firstTabLabel = await firstTab.getText();
      expect(firstTabLabel).to.match(/CaseManager\.cls/);

      const secondTab = await openEditorsView.findElement(By.css('.monaco-list-row:nth-child(2)'));
      const secondTabLabel = await secondTab.getText();
      expect(secondTabLabel).to.match(/CaseManager_\d{8}_\d{6}\.externalServiceRegistration-meta\.xml/);

      const thirdTab = await openEditorsView.findElement(By.css('.monaco-list-row:nth-child(3)'));
      const thirdTabLabel = await thirdTab.getText();
      expect(thirdTabLabel).to.match(/Manual Diff of ESR XML Files/);
    });
  });

  describe('Decomposed mode', () => {
    it('Add "decomposeExternalServiceRegistrationBeta" setting to sfdx-project.json', async () => {
      logTestStart(testSetup, 'Add "decomposeExternalServiceRegistrationBeta" setting to sfdx-project.json');
      const workbench = getWorkbench();
      await openFile(path.join(testSetup.projectFolderPath!, 'sfdx-project.json'));
      const textEditor = await getTextEditor(workbench, 'sfdx-project.json');
      const sfdxProjectJson = getSfdxProjectJson();
      await overrideTextInFile(textEditor, sfdxProjectJson);
      await executeQuickPick('View: Close All Editors');
      await reloadWindow();
    });

    it('Generate OAS doc from a valid Apex class using command palette - Decomposed mode, initial generation', async () => {
      logTestStart(
        testSetup,
        'Generate OAS doc from a valid Apex class using command palette - Decomposed mode, initial generation'
      );
      await executeQuickPick('View: Close All Editors');
      await openFile(
        path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'SimpleAccountResource.cls')
      );
      await pause(Duration.seconds(5));
      prompt = await executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      await prompt.confirm();

      await verifyNotificationWithRetry(/OpenAPI Document created for class: SimpleAccountResource\./);

      // Zoom out the editor view
      await zoom('Out', 2); // Zoom out the editor view

      // Verify both the YAML and XML files of the generated OAS doc are open in the Editor View
      await retryOperation(
        async () => {
          await pause(Duration.seconds(3)); // Allow time for files to be opened after generation
          const workbench = getWorkbench();
          const editorView = workbench.getEditorView();

          // Get all open tabs
          const openTabs = await editorView.getOpenTabs();
          if (!openTabs || openTabs.length === 0) {
            throw new Error('No tabs are open in the editor view');
          }

          // Collect all tab titles for verification
          const tabTitles = [];
          for (const tab of openTabs) {
            try {
              const title = await tab.getTitle();
              tabTitles.push(title);
            } catch (error) {
              tabTitles.push(`[Error: ${String(error)}]`);
            }
          }

          // Check if both expected files are open
          const hasYamlTab = tabTitles.includes('SimpleAccountResource.yaml');
          const hasXmlTab = tabTitles.includes('SimpleAccountResource.externalServiceRegistration-meta.xml');

          if (!hasYamlTab && !hasXmlTab) {
            throw new Error(`Neither YAML nor XML tab found. Open tabs: [${tabTitles.join(', ')}]`);
          } else if (!hasYamlTab) {
            throw new Error(`YAML tab not found. Open tabs: [${tabTitles.join(', ')}]`);
          } else if (!hasXmlTab) {
            throw new Error(`XML tab not found. Open tabs: [${tabTitles.join(', ')}]`);
          }

          // Both tabs are open - success!
          await zoomReset();
        },
        5,
        'CreateOASDoc - Error verifying generated files are open'
      );
    });

    it('Check for warnings and errors in the Problems Tab', async () => {
      logTestStart(testSetup, 'Check for warnings and errors in the Problems Tab');
      await countProblemsInProblemsTab(0);
    });

    it('Fix the OAS doc to get rid of the problems in the Problems Tab', async () => {
      // NOTE: The "fix" is actually replacing the OAS doc with the ideal solution from the EMU repo
      logTestStart(testSetup, 'Fix the OAS doc to get rid of the problems in the Problems Tab');

      const workbench = getWorkbench();
      let textEditor = await getTextEditor(workbench, 'SimpleAccountResource.yaml');
      const yamlText = getIdealSimpleAccountResourceYaml();
      await overrideTextInFile(textEditor, yamlText);

      textEditor = await getTextEditor(workbench, 'SimpleAccountResource.externalServiceRegistration-meta.xml');
      const xmlText = getIdealSimpleAccountResourceXml();
      await overrideTextInFile(textEditor, xmlText);
    });

    it('Revalidate the OAS doc', async () => {
      logTestStart(testSetup, 'Revalidate the OAS doc');
      const workbench = getWorkbench();
      const textEditor = await getTextEditor(workbench, 'SimpleAccountResource.yaml');

      // Use context menu for Windows and Ubuntu, command palette for Mac
      if (process.platform !== 'darwin') {
        const contextMenu = await textEditor.openContextMenu();
        await contextMenu.select('SFDX: Validate OpenAPI Document (Beta)');
      } else {
        await executeQuickPick('SFDX: Validate OpenAPI Document (Beta)');
      }
      await verifyNotificationWithRetry(/Validated OpenAPI Document SimpleAccountResource.yaml successfully/);

      await countProblemsInProblemsTab(0);
    });

    it('Deploy the decomposed ESR to the org', async () => {
      logTestStart(testSetup, 'Deploy the decomposed ESR to the org');
      const workbench = getWorkbench();
      // Clear the Output view first.
      await clearOutputView(Duration.seconds(2));
      await getTextEditor(workbench, 'SimpleAccountResource.externalServiceRegistration-meta.xml');
      await runAndValidateCommand(
        'Deploy',
        'to',
        'ST',
        'ExternalServiceRegistration',
        'SimpleAccountResource',
        'Created  '
      );
    });

    it('Generate OAS doc from a valid Apex class using context menu in Editor View - Decomposed mode, overwrite', async () => {
      logTestStart(
        testSetup,
        'Generate OAS doc from a valid Apex class using context menu in Editor View - Decomposed mode, overwrite'
      );
      await executeQuickPick('View: Close All Editors');
      await openFile(
        path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'SimpleAccountResource.cls')
      );
      await pause(Duration.seconds(5));

      // Use context menu for Windows and Ubuntu, command palette for Mac
      if (process.platform !== 'darwin') {
        log('Not Mac - can use context menu');
        const wrkbench = getWorkbench();
        const textEditor = await getTextEditor(wrkbench, 'SimpleAccountResource.cls');
        const contextMenu = await textEditor.openContextMenu();
        const menu = await contextMenu.select('SFDX: Create OpenAPI Document from This Class (Beta)');
        // Wait for the command palette prompt to appear
        if (menu) {
          const result = await getQuickOpenBoxOrInputBox();
          if (!result) {
            throw new Error('Failed to get QuickOpenBox or InputBox');
          }
          prompt = result;
        }
      } else {
        log('Mac - must use command palette');
        prompt = await executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      }
      await prompt.confirm();

      // Click the Overwrite button on the popup
      await clickButtonOnModalDialog('Overwrite');

      await verifyNotificationWithRetry(/OpenAPI Document created for class: SimpleAccountResource\./);

      await zoom('Out', 2); // Zoom out the editor view

      // Verify both the YAML and XML files of the generated OAS doc are open in the Editor View
      await retryOperation(
        async () => {
          await pause(Duration.seconds(3)); // Allow time for files to be opened after generation
          const workbench = getWorkbench();
          const editorView = workbench.getEditorView();

          // Get all open tabs
          const openTabs = await editorView.getOpenTabs();
          if (!openTabs || openTabs.length === 0) {
            throw new Error('No tabs are open in the editor view');
          }

          // Collect all tab titles for verification
          const tabTitles = [];
          for (const tab of openTabs) {
            try {
              const title = await tab.getTitle();
              tabTitles.push(title);
            } catch (error) {
              tabTitles.push(`[Error: ${String(error)}]`);
            }
          }

          // Check if both expected files are open
          const hasYamlTab = tabTitles.includes('SimpleAccountResource.yaml');
          const hasXmlTab = tabTitles.includes('SimpleAccountResource.externalServiceRegistration-meta.xml');

          if (!hasYamlTab && !hasXmlTab) {
            throw new Error(`Neither YAML nor XML tab found. Open tabs: [${tabTitles.join(', ')}]`);
          } else if (!hasYamlTab) {
            throw new Error(`YAML tab not found. Open tabs: [${tabTitles.join(', ')}]`);
          } else if (!hasXmlTab) {
            throw new Error(`XML tab not found. Open tabs: [${tabTitles.join(', ')}]`);
          }

          // Both tabs are open - success!
          await zoomReset();
        },
        5,
        'CreateOASDoc - Error verifying generated files are open (overwrite mode)'
      );
    });

    it('Generate OAS doc from a valid Apex class using context menu in Explorer View - Decomposed mode, manual merge', async () => {
      logTestStart(
        testSetup,
        'Generate OAS doc from a valid Apex class using context menu in Explorer View - Decomposed mode, manual merge'
      );
      await executeQuickPick('View: Close All Editors');
      await openFile(
        path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'SimpleAccountResource.cls')
      );
      await pause(Duration.seconds(5));

      // Use context menu for Windows and Ubuntu, command palette for Mac
      if (process.platform !== 'darwin') {
        log('Not Mac - can use context menu');
        await executeQuickPick('File: Focus on Files Explorer');
        await pause(Duration.seconds(2));
        const wrkbench = getWorkbench();
        const workbenchSidebar = await wrkbench.getSideBar().wait();
        const cont = await workbenchSidebar.getContent().wait();
        const treeViewSection = await cont.getSection(testSetup.tempProjectName);
        if (!treeViewSection) {
          throw new Error(
            'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
          );
        }

        // The force-app/main/default and classes folders are already expanded, so we can find the file directly
        const simpleAccountResourceFile = await treeViewSection.findItem('SimpleAccountResource.cls');
        if (!(simpleAccountResourceFile instanceof DefaultTreeItem)) {
          throw new Error(`Expected DefaultTreeItem but got different item type: ${typeof simpleAccountResourceFile}`);
        }
        const contextMenu = await simpleAccountResourceFile.openContextMenu();
        const menu = await contextMenu.select('SFDX: Create OpenAPI Document from This Class (Beta)');

        // Wait for the command palette prompt to appear
        if (menu) {
          const result = await getQuickOpenBoxOrInputBox();
          if (!result) {
            throw new Error('Failed to get QuickOpenBox or InputBox');
          }
          prompt = result;
        }
      } else {
        log('Mac - must use command palette');
        prompt = await executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      }
      await prompt.confirm();

      // Click the Manual Merge button on the popup
      await clickButtonOnModalDialog('Manually merge with existing ESR');

      await verifyNotificationWithRetry(
        /A new OpenAPI Document class SimpleAccountResource_\d{8}_\d{6} is created for SimpleAccountResource\. Manually merge the two files using the diff editor\./
      );

      // Verify the generated OAS doc and the diff editor are both open in the Editor View
      await executeQuickPick('View: Open First Editor in Group');
      const workbench = getWorkbench();
      await executeQuickPick('Explorer: Focus on Open Editors View');
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const openEditorsView = await content.getSection('Open Editors');

      const openTabs = await openEditorsView?.getVisibleItems();
      expect(openTabs?.length).to.equal(5);

      // Locate each tab in the Open Editors View using the selector (there is a bug in vscode-extension-tester)
      const firstTab = await openEditorsView.findElement(By.css('.monaco-list-row:nth-child(1)'));
      const firstTabLabel = await firstTab.getText();
      expect(firstTabLabel).to.match(/SimpleAccountResource\.cls/);

      const secondTab = await openEditorsView.findElement(By.css('.monaco-list-row:nth-child(2)'));
      const secondTabLabel = await secondTab.getText();
      expect(secondTabLabel).to.match(/SimpleAccountResource_\d{8}_\d{6}\.externalServiceRegistration-meta\.xml/);

      const thirdTab = await openEditorsView.findElement(By.css('.monaco-list-row:nth-child(3)'));
      const thirdTabLabel = await thirdTab.getText();
      expect(thirdTabLabel).to.match(/SimpleAccountResource_\d{8}_\d{6}\.yaml/);

      const fourthTab = await openEditorsView.findElement(By.css('.monaco-list-row:nth-child(4)'));
      const fourthTabLabel = await fourthTab.getText();
      expect(fourthTabLabel).to.match(/Manual Diff of ESR XML Files/);

      const fifthTab = await openEditorsView.findElement(By.css('.monaco-list-row:nth-child(5)'));
      const fifthTabLabel = await fifthTab.getText();
      expect(fifthTabLabel).to.match(/Manual Diff of ESR YAML Files/);
    });
  });

  describe('Disable A4D extension and ensure the commands to generate and validate OAS docs are not present', () => {
    it('Disable A4D extension', async () => {
      logTestStart(testSetup, 'Disable A4D extension');

      const extensionsView = await (await new ActivityBar().getViewControl('Extensions'))?.openView();
      await pause(Duration.seconds(5));
      const extensionsList = await extensionsView?.getContent().getSection('Installed');
      if (!(extensionsList instanceof ExtensionsViewSection)) {
        throw new Error(`Expected ExtensionsViewSection but got different section type: ${typeof extensionsList}`);
      }
      const a4dExtension = await extensionsList?.findItem('Agentforce for Developers');
      if (!(a4dExtension instanceof ExtensionsViewItem)) {
        throw new Error(`Expected ExtensionsViewItem but got different item type: ${typeof a4dExtension}`);
      }
      await a4dExtension.click();

      // In the extension details view, click the Disable button
      const disableButton = await a4dExtension.findElement(
        By.xpath("//a[contains(@class, 'action-label') and contains(@class, 'extension-action') and text()='Disable']")
      );
      await disableButton?.click();
      await pause(Duration.seconds(5));

      // Click the Restart Extensions button
      const restartExtensionsButton = await a4dExtension.findElement(
        By.xpath("//a[contains(@class, 'action-label') and contains(@class, 'reload') and text()='Restart Extensions']")
      );
      await restartExtensionsButton?.click();
      await pause(Duration.seconds(5));

      // Verify the A4D extension is disabled
      expect(await a4dExtension.isInstalled()).to.equal(true);
      expect(await a4dExtension.isEnabled()).to.equal(false);
    });

    it('Ensure the commands to generate and validate OAS docs are not present', async () => {
      logTestStart(testSetup, 'Ensure the commands to generate and validate OAS docs are not present');
      await executeQuickPick('View: Close All Editors');
      await reloadWindow(Duration.seconds(5));

      await openFile(
        path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'CaseManager.cls')
      );
      await pause(Duration.seconds(5));
      expect(await isCommandAvailable('SFDX: Create OpenAPI Document from This Class (Beta)')).to.equal(false);

      await openFile(
        path.join(
          testSetup.projectFolderPath!,
          'force-app',
          'main',
          'default',
          'externalServiceRegistrations',
          'SimpleAccountResource.yaml'
        )
      );
      await pause(Duration.seconds(5));
      expect(await isCommandAvailable('SFDX: Validate OpenAPI Document (Beta)')).to.equal(false);
    });
  });

  after('Tear down and clean up the testing environment', async () => {
    log('\nCreateOASDoc - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });

  const getQuickOpenBoxOrInputBox = async (): Promise<QuickOpenBox | InputBox | undefined> => {
    log('Enter getQuickOpenBoxOrInputBox()');
    try {
      const quickOpenBox = await new QuickOpenBox().wait();
      return quickOpenBox;
    } catch {
      try {
        const inputBox = await new InputBox().wait();
        return inputBox;
      } catch {
        return undefined;
      }
    }
  };
});
