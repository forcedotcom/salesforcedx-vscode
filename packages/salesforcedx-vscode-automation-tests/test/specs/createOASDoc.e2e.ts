/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import { TestSetup } from '../testSetup';
import * as utilities from '../utilities/index';
import { expect } from 'chai';
import path from 'path';
import { InputBox, QuickOpenBox, ExtensionsViewSection, ActivityBar, after, By, ExtensionsViewItem, DefaultTreeItem } from 'vscode-extension-tester';

describe('Create OpenAPI v3 Specifications', async () => {
  let prompt: QuickOpenBox | InputBox;
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'CreateOASDoc'
  };

  step('Set up the testing environment', async () => {
    utilities.log(`CreateOASDoc - Set up the testing environment`);
    testSetup = await TestSetup.setUp(testReqConfig);

    // Set SF_LOG_LEVEL to 'debug' to get the logs in the 'llm_logs' folder when the OAS doc is generated
    await utilities.setSettingValue('salesforcedx-vscode-core.SF_LOG_LEVEL', 'debug', true);

    // Set a telemetry tag to distinguish it as an E2E test run
    await utilities.setSettingValue('salesforcedx-vscode-core.telemetry-tag', 'e2e-test', true);

    // Use VSCode's modal dialog style instead of Mac's native dialog style
    await utilities.setSettingValue('window.dialogStyle', 'custom', false);

    // Disable preview mode for opening editors
    await utilities.setSettingValue('workbench.editor.enablePreview', false, false);
    await utilities.executeQuickPick('View: Close Editor');
    await utilities.reloadWindow();

    // Install A4D extension
    const extensionsView = await (await new ActivityBar().getViewControl('Extensions'))?.openView();
    await utilities.pause(utilities.Duration.seconds(5));
    const extensionsList = (await extensionsView?.getContent().getSection('Installed')) as ExtensionsViewSection;
    const a4dExtension = await extensionsList?.findItem('Agentforce for Developers');
    await a4dExtension?.install();
    await utilities.executeQuickPick('View: Close Editor');

    // Create the Apex class which the decomposed OAS doc will be generated from
    const caseManagerText = [
      `@RestResource(urlMapping='/apex-rest-examples/v1/Cases/*')`,
      `global with sharing class CaseManager {`,
      `  @HttpPost`,
      `  global static ID createCase(String subject, String status,`,
      `    String origin, String priority) {`,
      `    Case thisCase = new Case(`,
      `      Subject=subject,`,
      `      Status=status,`,
      `      Origin=origin,`,
      `      Priority=priority);`,
      `    insert thisCase;`,
      `    return thisCase.Id;`,
      `  }`,
      `}`
    ].join('\n');

    try {
      await utilities.createApexClass('CaseManager', caseManagerText);
    } catch (error) {
      await utilities.createApexClass('CaseManager', caseManagerText);
    }

    // Create the Apex class which the composed OAS doc will be generated from
    const simpleAccountResourceText = [
      `@RestResource(urlMapping='/apex-rest-examples/v1/*')`,
      `global with sharing class SimpleAccountResource {`,
      `  @HttpGet`,
      `  global static Account getAccount() {`,
      `    RestRequest req = RestContext.request;`,
      `    RestResponse res = RestContext.response;`,
      `    String accountId = req.requestURI.substring(req.requestURI.lastIndexOf('/')+1);`,
      `    Account result = [SELECT Id, Name, Phone, Website FROM Account WHERE Id = :accountId];`,
      `    return result;`,
      `  }`,
      `}`
    ].join('\n');

    try {
      await utilities.createApexClass('SimpleAccountResource', simpleAccountResourceText);
    } catch (error) {
      await utilities.createApexClass('SimpleAccountResource', simpleAccountResourceText);
    }

    // Create an ineligible Apex class (the default Apex class from the template is a good example)
    try {
      await utilities.createCommand('Apex Class', 'IneligibleApexClass', 'classes', 'cls');
    } catch (error) {
      await utilities.createCommand('Apex Class', 'IneligibleApexClass', 'classes', 'cls');
    }

    // Push source to org
    await utilities.executeQuickPick(
      'SFDX: Push Source to Default Org and Ignore Conflicts',
      utilities.Duration.seconds(1)
    );

    // Look for the success notification that appears which says, "SFDX: Push Source to Default Org and Ignore Conflicts successfully ran".
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
        utilities.Duration.TEN_MINUTES
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

  step('Try to generate OAS doc from an ineligible Apex class', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Try to generate OAS doc from an ineligible Apex class`);
    await utilities.openFile(path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'IneligibleApexClass.cls'));
    if (process.platform === "win32") {
      utilities.reloadWindow();
      await utilities.verifyExtensionsAreRunning(utilities.getExtensionsToVerifyActive());
      const workbench = utilities.getWorkbench();
      await utilities.getTextEditor(workbench, 'IneligibleApexClass.cls');
    } else {
      await utilities.pause(utilities.Duration.seconds(5));
    }
    try {
      await utilities.executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      const failureNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /Failed to create OpenAPI Document: The Apex Class IneligibleApexClass is not valid for OpenAPI document generation\./,
        utilities.Duration.TEN_MINUTES
      );
      expect(failureNotificationWasFound).to.equal(true);
    } catch (error) {
      await utilities.pause(utilities.Duration.minutes(1));
      await utilities.executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      const failureNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /Failed to create OpenAPI Document: The Apex Class IneligibleApexClass is not valid for OpenAPI document generation\./,
        utilities.Duration.TEN_MINUTES
      );
      expect(failureNotificationWasFound).to.equal(true);
    }
  });

  describe('Composed mode', async () => {
    step('Generate OAS doc from a valid Apex class using command palette - Composed mode, initial generation', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Generate OAS doc from a valid Apex class using command palette - Composed mode, initial generation`);
      await utilities.executeQuickPick('View: Close All Editors');
      await utilities.openFile(path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'CaseManager.cls'));
      await utilities.pause(utilities.Duration.seconds(5));
      prompt = await utilities.executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      await prompt.confirm();

      const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /OpenAPI Document created for class: CaseManager\./,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      // Verify the generated OAS doc is open in the Editor View
      await utilities.executeQuickPick('View: Open Last Editor in Group');
      const workbench = utilities.getWorkbench();
      const editorView = workbench.getEditorView();
      const activeTab = await editorView.getActiveTab();
      const title = await activeTab?.getTitle();
      expect(title).to.equal('CaseManager.externalServiceRegistration-meta.xml');
    });

    step('Check for warnings and errors in the Problems Tab', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Check for warnings and errors in the Problems Tab`);
      await utilities.countProblemsInProblemsTab(0);
    });

    step('Fix the OAS doc to get rid of the problems in the Problems Tab', async () => {
      // NOTE: The "fix" is actually replacing the OAS doc with the ideal solution
      utilities.log(`${testSetup.testSuiteSuffixName} - Fix the OAS doc to get rid of the problems in the Problems Tab`);

      const idealCaseManagerOASDoc = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">`,
        `  <description>This is the ideal OpenAPI v3 specification for CaseManager.cls.</description>`,
        `  <label>CaseManager</label>`,
        `  <schema>openapi: 3.0.0`,
        `info:`,
        `  title: CaseManager`,
        `  version: &apos;1.0.0&apos;`,
        `  description: This is the ideal OpenAPI v3 specification for CaseManager.cls.`,
        `servers:`,
        `  - url: /services/apexrest`,
        `    description: Apex rest`,
        `paths:`,
        `  /apex-rest-examples/v1/Cases:`,
        `    description: The endpoint that contains the POST method.`,
        `    post:`,
        `      summary: Create a new case`,
        `      description: Creates a new case with the provided information.`,
        `      operationId: createCase`,
        `      requestBody:`,
        `        description: The properties of the case to create.`,
        `        content:`,
        `          application/json:`,
        `            schema:`,
        `              type: object`,
        `              properties:`,
        `                subject:`,
        `                  type: string`,
        `                  description: The subject of the case`,
        `                status:`,
        `                  type: string`,
        `                  description: The status of the case`,
        `                origin:`,
        `                  type: string`,
        `                  description: The origin of the case`,
        `                priority:`,
        `                  type: string`,
        `                  description: The priority of the case`,
        `      responses:`,
        `        &apos;200&apos;:`,
        `          description: The ID of the newly created case.`,
        `          content:`,
        `            text/plain:`,
        `              schema:`,
        `                type: string`,
        `</schema>`,
        `  <schemaType>OpenApi3</schemaType>`,
        `  <schemaUploadFileExtension>yaml</schemaUploadFileExtension>`,
        `  <schemaUploadFileName>casemanager_openapi</schemaUploadFileName>`,
        `  <status>Complete</status>`,
        `  <systemVersion>3</systemVersion>`,
        `  <operations>`,
        `    <name>createCase</name>`,
        `    <active>true</active>`,
        `  </operations>`,
        `  <registrationProvider>CaseManager</registrationProvider>`,
        `  <registrationProviderType>ApexRest</registrationProviderType>`,
        `  <namedCredential>null</namedCredential>`,
        `</ExternalServiceRegistration>`
      ].join('\n');

      const workbench = utilities.getWorkbench();
      const textEditor = await utilities.getTextEditor(workbench, 'CaseManager.externalServiceRegistration-meta.xml');
      await textEditor.setText(idealCaseManagerOASDoc);
      await textEditor.save();
      await utilities.pause(utilities.Duration.seconds(1));
    });

    step('Revalidate the OAS doc', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Revalidate the OAS doc`);
      await utilities.executeQuickPick('SFDX: Validate OpenAPI Document (Beta)');
      const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /Validated OpenAPI Document CaseManager.externalServiceRegistration-meta.xml successfully/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      const problems = await utilities.countProblemsInProblemsTab(2);
      expect(await problems[0].getLabel()).to.equal('CaseManager.externalServiceRegistration-meta.xml');
      expect(await problems[1].getLabel()).to.equal('operations.responses.content should be application/json');
    });

    step('Deploy the composed ESR to the org', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Deploy the composed ESR to the org`);
      const workbench = utilities.getWorkbench();
      // Clear the Output view first.
      await utilities.clearOutputView(utilities.Duration.seconds(2));
      await utilities.getTextEditor(workbench, 'CaseManager.externalServiceRegistration-meta.xml');
      await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'ExternalServiceRegistration', 'CaseManager', 'Created  ');
    });

    step('Generate OAS doc from a valid Apex class using command palette - Composed mode, manual merge', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Generate OAS doc from a valid Apex class using command palette - Composed mode, manual merge`);
      await utilities.executeQuickPick('View: Close All Editors');
      await utilities.openFile(path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'CaseManager.cls'));
      await utilities.pause(utilities.Duration.seconds(5));
      prompt = await utilities.executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      await prompt.confirm();

      // Click the Manual Merge button on the popup
      await utilities.clickButtonOnModalDialog('Manually merge with existing ESR');

      const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /A new OpenAPI Document class CaseManager_\d{8}_\d{6} is created for CaseManager\. Manually merge the two files using the diff editor\./,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      // Verify the generated OAS doc and the diff editor are both open in the Editor View
      await utilities.executeQuickPick('View: Open First Editor in Group');
      const workbench = utilities.getWorkbench();
      await utilities.executeQuickPick('Explorer: Focus on Open Editors View');
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

  describe('Decomposed mode', async () => {
    step('Add "decomposeExternalServiceRegistrationBeta" setting to sfdx-project.json', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Add "decomposeExternalServiceRegistrationBeta" setting to sfdx-project.json`);
      const workbench = utilities.getWorkbench();
      await utilities.openFile(path.join(testSetup.projectFolderPath!, 'sfdx-project.json'));
      const textEditor = await utilities.getTextEditor(workbench, 'sfdx-project.json');
      const newSfdxProjectJsonContents = [
        `{`,
        `  "packageDirectories": [`,
        `    {`,
        `      "path": "force-app",`,
        `      "default": true`,
        `    }`,
        `  ],`,
        `  "name": "TempProject-CreateOASDoc",`,
        `  "namespace": "",`,
        `  "sfdcLoginUrl": "https://login.salesforce.com",`,
        `  "sourceApiVersion": "63.0",`,
        `  "sourceBehaviorOptions": [`,
        `    "decomposeExternalServiceRegistrationBeta"`,
        `  ]`,
        `}`
      ].join('\n');
      await textEditor.setText(newSfdxProjectJsonContents);
      await textEditor.save();
      await utilities.executeQuickPick('View: Close All Editors');
      await utilities.reloadWindow();
    });

    step('Generate OAS doc from a valid Apex class using command palette - Decomposed mode, initial generation', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Generate OAS doc from a valid Apex class using command palette - Decomposed mode, initial generation`);
      await utilities.executeQuickPick('View: Close All Editors');
      await utilities.openFile(path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'SimpleAccountResource.cls'));
      await utilities.pause(utilities.Duration.seconds(5));
      prompt = await utilities.executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      await prompt.confirm();

      const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /OpenAPI Document created for class: SimpleAccountResource\./,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      // Verify both the YAML and XML files of the generated OAS doc are open in the Editor View
      await utilities.executeQuickPick('View: Open Last Editor in Group');
      const workbench = utilities.getWorkbench();
      const editorView = workbench.getEditorView();
      let activeTab = await editorView.getActiveTab();
      let title = await activeTab?.getTitle();
      expect(title).to.equal('SimpleAccountResource.yaml');

      await utilities.executeQuickPick('View: Open Previous Editor');
      activeTab = await editorView.getActiveTab();
      title = await activeTab?.getTitle();
      expect(title).to.equal('SimpleAccountResource.externalServiceRegistration-meta.xml');
    });

    step('Check for warnings and errors in the Problems Tab', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Check for warnings and errors in the Problems Tab`);
      await utilities.countProblemsInProblemsTab(0);
    });

    step('Fix the OAS doc to get rid of the problems in the Problems Tab', async () => {
      // NOTE: The "fix" is actually replacing the OAS doc with the ideal solution from the EMU repo
      utilities.log(`${testSetup.testSuiteSuffixName} - Fix the OAS doc to get rid of the problems in the Problems Tab`);

      const idealSimpleAccountResourceYAML = [
        `openapi: 3.0.0`,
        `servers:`,
        `  - url: /services/apexrest`,
        `info:`,
        `  title: SimpleAccountResource`,
        `  version: '1.0.0'`,
        `  description: This is the ideal OpenAPI v3 specification for SimpleAccountResource.cls.`,
        `paths:`,
        `  /apex-rest-examples/v1/{accountId}:`,
        `    description: The endpoint that contains the GET method.`,
        `    get:`,
        `      summary: Get Account`,
        `      operationId: getAccount`,
        `      description: Returns the Account that matches the ID specified in the URL`,
        `      parameters:`,
        `        - name: accountId`,
        `          in: path`,
        `          required: true`,
        `          description: The ID of the Account to retrieve`,
        `          schema:`,
        `            type: string`,
        `      responses:`,
        `        '200':`,
        `          description: The Account with the provided ID`,
        `          content:`,
        `            application/json:`,
        `              schema:`,
        `                type: object`,
        `                properties:`,
        `                  Id:`,
        `                    type: string`,
        `                    description: The ID of the Account`,
        `                  Name:`,
        `                    type: string`,
        `                    description: The name of the Account`,
        `                  Phone:`,
        `                    type: string`,
        `                    description: The phone number of the Account`,
        `                  Website:`,
        `                    type: string`,
        `                    description: The website of the Account`
      ].join('\n');

      const workbench = utilities.getWorkbench();
      let textEditor = await utilities.getTextEditor(workbench, 'SimpleAccountResource.yaml');
      await textEditor.setText(idealSimpleAccountResourceYAML);
      await textEditor.save();

      const idealSimpleAccountResourceXML = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">`,
        `  <description>This is the ideal OpenAPI v3 specification for SimpleAccountResource.cls.</description>`,
        `  <label>SimpleAccountResource</label>`,
        `  <schemaType>OpenApi3</schemaType>`,
        `  <schemaUploadFileExtension>yaml</schemaUploadFileExtension>`,
        `  <schemaUploadFileName>simpleaccountresource_openapi</schemaUploadFileName>`,
        `  <status>Complete</status>`,
        `  <systemVersion>3</systemVersion>`,
        `  <operations>`,
        `    <name>getAccount</name>`,
        `    <active>true</active>`,
        `  </operations>`,
        `  <registrationProvider>SimpleAccountResource</registrationProvider>`,
        `  <registrationProviderType>ApexRest</registrationProviderType>`,
        `  <namedCredential>null</namedCredential>`,
        `</ExternalServiceRegistration>`
      ].join('\n');

      textEditor = await utilities.getTextEditor(workbench, 'SimpleAccountResource.externalServiceRegistration-meta.xml');
      await textEditor.setText(idealSimpleAccountResourceXML);
      await textEditor.save();
      await utilities.pause(utilities.Duration.seconds(1));
    });

    step('Revalidate the OAS doc', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Revalidate the OAS doc`);
      const workbench = utilities.getWorkbench();
      const textEditor = await utilities.getTextEditor(workbench, 'SimpleAccountResource.yaml');

      // Use context menu for Windows and Ubuntu, command palette for Mac
      if (process.platform !== 'darwin') {
        const contextMenu = await textEditor.openContextMenu();
        await contextMenu.select('SFDX: Validate OpenAPI Document (Beta)');
      } else {
        await utilities.executeQuickPick('SFDX: Validate OpenAPI Document (Beta)');
      }
      const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /Validated OpenAPI Document SimpleAccountResource.yaml successfully/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      await utilities.countProblemsInProblemsTab(0);
    });

    step('Deploy the decomposed ESR to the org', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Deploy the decomposed ESR to the org`);
      const workbench = utilities.getWorkbench();
      // Clear the Output view first.
      await utilities.clearOutputView(utilities.Duration.seconds(2));
      await utilities.getTextEditor(workbench, 'SimpleAccountResource.externalServiceRegistration-meta.xml');
      await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'ExternalServiceRegistration', 'SimpleAccountResource', 'Created  ');
    });

    step('Generate OAS doc from a valid Apex class using context menu in Editor View - Decomposed mode, overwrite', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Generate OAS doc from a valid Apex class using context menu in Editor View - Decomposed mode, overwrite`);
      await utilities.executeQuickPick('View: Close All Editors');
      await utilities.openFile(path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'SimpleAccountResource.cls'));
      await utilities.pause(utilities.Duration.seconds(5));

      // Use context menu for Windows and Ubuntu, command palette for Mac
      if (process.platform !== 'darwin') {
        utilities.log('Not Mac - can use context menu');
        const workbench = utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'SimpleAccountResource.cls');
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
        utilities.log('Mac - must use command palette')
        prompt = await utilities.executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      }
      await prompt.confirm();

      // Click the Overwrite button on the popup
      await utilities.clickButtonOnModalDialog('Overwrite');

      const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /OpenAPI Document created for class: SimpleAccountResource\./,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      // Verify both the YAML and XML files of the generated OAS doc are open in the Editor View
      await utilities.executeQuickPick('View: Open Last Editor in Group');
      const workbench = utilities.getWorkbench();
      const editorView = workbench.getEditorView();
      let activeTab = await editorView.getActiveTab();
      let title = await activeTab?.getTitle();
      expect(title).to.equal('SimpleAccountResource.yaml');

      await utilities.executeQuickPick('View: Open Previous Editor');
      activeTab = await editorView.getActiveTab();
      title = await activeTab?.getTitle();
      expect(title).to.equal('SimpleAccountResource.externalServiceRegistration-meta.xml');
    });

    step('Generate OAS doc from a valid Apex class using context menu in Explorer View - Decomposed mode, manual merge', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Generate OAS doc from a valid Apex class using context menu in Explorer View - Decomposed mode, manual merge`);
      await utilities.executeQuickPick('View: Close All Editors');
      await utilities.openFile(path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'SimpleAccountResource.cls'));
      await utilities.pause(utilities.Duration.seconds(5));

      // Use context menu for Windows and Ubuntu, command palette for Mac
      if (process.platform !== 'darwin') {
        utilities.log('Not Mac - can use context menu');
        await utilities.executeQuickPick('File: Focus on Files Explorer');
        await utilities.pause(utilities.Duration.seconds(2));
        const workbench = utilities.getWorkbench();
        const sidebar = await workbench.getSideBar().wait();
        const content = await sidebar.getContent().wait();
        const treeViewSection = await content.getSection(testSetup.tempProjectName);
        if (!treeViewSection) {
          throw new Error(
            'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
          );
        }

        // The force-app/main/default and classes folders are already expanded, so we can find the file directly
        const simpleAccountResourceFile = await treeViewSection.findItem('SimpleAccountResource.cls') as DefaultTreeItem;
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
        utilities.log('Mac - must use command palette')
        prompt = await utilities.executeQuickPick('SFDX: Create OpenAPI Document from This Class (Beta)');
      }
      await prompt.confirm();

      // Click the Manual Merge button on the popup
      await utilities.clickButtonOnModalDialog('Manually merge with existing ESR');

      const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /A new OpenAPI Document class SimpleAccountResource_\d{8}_\d{6} is created for SimpleAccountResource\. Manually merge the two files using the diff editor\./,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      // Verify the generated OAS doc and the diff editor are both open in the Editor View
      await utilities.executeQuickPick('View: Open First Editor in Group');
      const workbench = utilities.getWorkbench();
      await utilities.executeQuickPick('Explorer: Focus on Open Editors View');
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

  describe('Disable A4D extension and ensure the commands to generate and validate OAS docs are not present', async () => {
    step('Disable A4D extension', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Disable A4D extension`);

      const extensionsView = await (await new ActivityBar().getViewControl('Extensions'))?.openView();
      await utilities.pause(utilities.Duration.seconds(5));
      let extensionsList = (await extensionsView?.getContent().getSection('Installed')) as ExtensionsViewSection;
      const a4dExtension = await extensionsList?.findItem('Agentforce for Developers') as ExtensionsViewItem;
      await a4dExtension.click();

      // In the extension details view, click the Disable button
      const disableButton = await a4dExtension.findElement(By.xpath("//a[contains(@class, 'action-label') and contains(@class, 'extension-action') and text()='Disable']"));
      await disableButton?.click();
      await utilities.pause(utilities.Duration.seconds(5));

      // Click the Restart Extensions button
      const restartExtensionsButton = await a4dExtension.findElement(By.xpath("//a[contains(@class, 'action-label') and contains(@class, 'reload') and text()='Restart Extensions']"));
      await restartExtensionsButton?.click();
      await utilities.pause(utilities.Duration.seconds(5));

      // Verify the A4D extension is disabled
      expect(await a4dExtension.isInstalled()).to.equal(true);
      expect(await a4dExtension.isEnabled()).to.equal(false);
    });

    step('Ensure the commands to generate and validate OAS docs are not present', async () => {
      utilities.log(`${testSetup.testSuiteSuffixName} - Ensure the commands to generate and validate OAS docs are not present`);
      await utilities.executeQuickPick('View: Close All Editors');
      await utilities.reloadWindow(utilities.Duration.seconds(5));

      await utilities.openFile(path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes', 'CaseManager.cls'));
      await utilities.pause(utilities.Duration.seconds(5));
      expect(await utilities.isCommandAvailable('SFDX: Create OpenAPI Document from This Class (Beta)')).to.equal(false);

      await utilities.openFile(path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'externalServiceRegistrations', 'SimpleAccountResource.yaml'));
      await utilities.pause(utilities.Duration.seconds(5));
      expect(await utilities.isCommandAvailable('SFDX: Validate OpenAPI Document (Beta)')).to.equal(false);
    });
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`CreateOASDoc - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });

  const getQuickOpenBoxOrInputBox = async (): Promise<QuickOpenBox | InputBox | undefined> => {
    utilities.log('Enter getQuickOpenBoxOrInputBox()');
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
  }
});
