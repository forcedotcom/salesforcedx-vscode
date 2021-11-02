/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TemplateService } from '@salesforce/templates';
import { nls as templatesNls } from '@salesforce/templates/lib/i18n';
import * as path from 'path';
import * as shell from 'shelljs';
import { SinonStub, stub } from 'sinon';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import {
  forceApexClassCreate,
  forceLightningLwcCreate
} from '../../../../src/commands/templates';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import { ConfigUtil, getRootWorkspacePath } from '../../../../src/util';

const TEST_CUSTOM_TEMPLATES_REPO =
  'https://github.com/forcedotcom/salesforcedx-templates/tree/main/packages/templates/test/custom-templates';
const NON_EXISTENT_LOCAL_PATH = 'this-folder-does-not-exist';
const NON_EXISTENT_REPO =
  'https://github.com/forcedotcom/this-repo-does-not-exist';

describe('Custom Templates Create', () => {
  let showInputBoxStub: SinonStub;
  let quickPickStub: SinonStub;
  let appendLineStub: SinonStub;
  let showSuccessfulExecutionStub: SinonStub;
  let showFailedExecutionStub: SinonStub;
  let openTextDocumentStub: SinonStub;
  let sendCommandEventStub: SinonStub;
  let sendExceptionStub: SinonStub;
  let getConfigValue: SinonStub;

  beforeEach(() => {
    showInputBoxStub = stub(vscode.window, 'showInputBox');
    quickPickStub = stub(vscode.window, 'showQuickPick');
    appendLineStub = stub(channelService, 'appendLine');
    showSuccessfulExecutionStub = stub(
      notificationService,
      'showSuccessfulExecution'
    );
    showSuccessfulExecutionStub.returns(Promise.resolve());
    showFailedExecutionStub = stub(notificationService, 'showFailedExecution');
    openTextDocumentStub = stub(vscode.workspace, 'openTextDocument');
    sendCommandEventStub = stub(telemetryService, 'sendCommandEvent');
    sendExceptionStub = stub(telemetryService, 'sendException');
    getConfigValue = stub(ConfigUtil, 'getConfigValue');
    getConfigValue.returns(undefined);
  });

  afterEach(() => {
    showInputBoxStub.restore();
    quickPickStub.restore();
    showSuccessfulExecutionStub.restore();
    showFailedExecutionStub.restore();
    appendLineStub.restore();
    openTextDocumentStub.restore();
    sendCommandEventStub.restore();
    sendExceptionStub.restore();
    getConfigValue.restore();
  });

  it('Should create Apex Class with custom templates', async () => {
    // arrange
    getConfigValue.returns(TEST_CUSTOM_TEMPLATES_REPO);
    const outputPath = 'force-app/main/default/classes';
    const apexClassPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'TestApexClass.cls'
    );
    const apexClassMetaPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'TestApexClass.cls-meta.xml'
    );
    shell.rm('-f', apexClassPath);
    shell.rm('-f', apexClassMetaPath);
    assert.noFile([apexClassPath, apexClassMetaPath]);
    showInputBoxStub.returns('TestApexClass');
    quickPickStub.returns(outputPath);

    // act
    await forceApexClassCreate();

    // assert
    const defaultApiVersion = TemplateService.getDefaultApiVersion();
    assert.file([apexClassPath, apexClassMetaPath]);
    assert.fileContent(
      apexClassPath,
      'public with sharing class CustomTestApexClass'
    );
    assert.fileContent(
      apexClassMetaPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${defaultApiVersion}</apiVersion>
    <status>Inactive</status>
</ApexClass>`
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, apexClassPath);

    sinon.assert.calledOnce(sendCommandEventStub);
    sinon.assert.calledWith(
      sendCommandEventStub,
      'force_apex_class_create',
      sinon.match.array,
      {
        dirType: 'defaultDir',
        commandExecutor: 'library',
        isUsingCustomOrgMetadataTemplates: 'true'
      }
    );

    // clean up
    shell.rm('-f', apexClassPath);
    shell.rm('-f', apexClassMetaPath);
  }).timeout(20000);

  it('Should handle error and log telemetry if local template does not exist', async () => {
    // arrange
    getConfigValue.returns(NON_EXISTENT_LOCAL_PATH);
    const outputPath = 'force-app/main/default/classes';
    const apexClassPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'TestApexClass.cls'
    );
    const apexClassMetaPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'TestApexClass.cls-meta.xml'
    );
    shell.rm('-f', apexClassPath);
    shell.rm('-f', apexClassMetaPath);
    assert.noFile([apexClassPath, apexClassMetaPath]);
    showInputBoxStub.returns('TestApexClass');
    quickPickStub.returns(outputPath);

    // act
    await forceApexClassCreate();

    // assert
    const errorMessage = templatesNls.localize(
      'localCustomTemplateDoNotExist',
      NON_EXISTENT_LOCAL_PATH
    );
    sinon.assert.calledOnce(appendLineStub);
    sinon.assert.calledWith(appendLineStub, errorMessage);
    sinon.assert.calledOnce(showFailedExecutionStub);
    sinon.assert.calledWith(
      showFailedExecutionStub,
      nls.localize('force_apex_class_create_text')
    );
    sinon.assert.calledOnce(sendExceptionStub);
    sinon.assert.calledWith(
      sendExceptionStub,
      'force_template_create_library',
      errorMessage
    );
  });

  it('Should handle error and log telemetry if cannot retrieve default branch', async () => {
    // arrange
    getConfigValue.returns(NON_EXISTENT_REPO);
    const outputPath = 'force-app/main/default/classes';
    const apexClassPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'TestApexClass.cls'
    );
    const apexClassMetaPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'TestApexClass.cls-meta.xml'
    );
    shell.rm('-f', apexClassPath);
    shell.rm('-f', apexClassMetaPath);
    assert.noFile([apexClassPath, apexClassMetaPath]);
    showInputBoxStub.returns('TestApexClass');
    quickPickStub.returns(outputPath);

    // act
    await forceApexClassCreate();

    // assert
    const errorMessage = templatesNls.localize(
      'customTemplatesCannotRetrieveDefaultBranch',
      NON_EXISTENT_REPO
    );
    sinon.assert.calledOnce(appendLineStub);
    sinon.assert.calledWith(appendLineStub, errorMessage);
    sinon.assert.calledOnce(showFailedExecutionStub);
    sinon.assert.calledWith(
      showFailedExecutionStub,
      nls.localize('force_apex_class_create_text')
    );
    sinon.assert.calledOnce(sendExceptionStub);
    sinon.assert.calledWith(
      sendExceptionStub,
      'force_template_create_library',
      errorMessage
    );
  });

  it('Should create from default template if git repo templates do not have the template type', async () => {
    // arrange
    getConfigValue.returns(TEST_CUSTOM_TEMPLATES_REPO);
    const fileName = 'testLwc';
    const outputPath = 'force-app/main/default/lwc';
    const lwcHtmlPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      fileName,
      'testLwc.html'
    );
    const lwcJsPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      fileName,
      'testLwc.js'
    );
    const lwcJsMetaPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      fileName,
      'testLwc.js-meta.xml'
    );
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
    assert.noFile([lwcHtmlPath, lwcJsPath, lwcJsMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await forceLightningLwcCreate();

    // assert
    const defaultApiVersion = TemplateService.getDefaultApiVersion();
    assert.file([lwcHtmlPath, lwcJsPath, lwcJsMetaPath]);
    assert.fileContent(lwcHtmlPath, `<template>\n    \n</template>`);
    assert.fileContent(
      lwcJsPath,
      `import { LightningElement } from 'lwc';

export default class TestLwc extends LightningElement {}`
    );
    assert.fileContent(
      lwcJsMetaPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${defaultApiVersion}</apiVersion>
    <isExposed>false</isExposed>
</LightningComponentBundle>`
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, lwcJsPath);

    sinon.assert.calledOnce(sendCommandEventStub);
    sinon.assert.calledWith(
      sendCommandEventStub,
      'force_lightning_web_component_create',
      sinon.match.array,
      {
        dirType: 'defaultDir',
        commandExecutor: 'library',
        isUsingCustomOrgMetadataTemplates: 'true'
      }
    );

    // clean up
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
  }).timeout(20000);
});
