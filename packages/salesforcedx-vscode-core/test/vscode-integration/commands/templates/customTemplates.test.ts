/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { nls as templatesNls } from '@salesforce/templates/lib/i18n';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import { apexGenerateClass, lightningGenerateLwc } from '../../../../src/commands/templates';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import { workspaceUtils } from '../../../../src/util';

const TEST_CUSTOM_TEMPLATES_REPO =
  'https://github.com/forcedotcom/salesforcedx-templates/tree/main/test/custom-templates';
const NON_EXISTENT_LOCAL_PATH = 'this-folder-does-not-exist';
const NON_EXISTENT_REPO = 'https://github.com/forcedotcom/this-repo-does-not-exist';

const sandbox = createSandbox();

describe('Custom Templates Create', () => {
  let showInputBoxStub: SinonStub;
  let quickPickStub: SinonStub;
  let appendLineStub: SinonStub;
  let showSuccessfulExecutionStub: SinonStub;
  let showFailedExecutionStub: SinonStub;
  let openTextDocumentStub: SinonStub;
  let sendCommandEventStub: SinonStub;
  let sendExceptionStub: SinonStub;
  let getTemplatesDirectoryStub: SinonStub;

  beforeEach(() => {
    showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
    quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    appendLineStub = sandbox.stub(channelService, 'appendLine');
    showSuccessfulExecutionStub = sandbox.stub(notificationService, 'showSuccessfulExecution');
    showSuccessfulExecutionStub.returns(Promise.resolve());
    showFailedExecutionStub = sandbox.stub(notificationService, 'showFailedExecution');
    openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument');
    sendCommandEventStub = sandbox.stub(telemetryService, 'sendCommandEvent');
    sendExceptionStub = sandbox.stub(telemetryService, 'sendException');
    getTemplatesDirectoryStub = sandbox.stub(ConfigUtil, 'getTemplatesDirectory');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should create Apex Class with custom templates', async () => {
    // arrange
    getTemplatesDirectoryStub.returns(TEST_CUSTOM_TEMPLATES_REPO);
    const outputPath = 'force-app/main/default/classes';
    const apexClassPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'TestApexClass.cls');
    const apexClassMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'TestApexClass.cls-meta.xml'
    );
    shell.rm('-f', apexClassPath);
    shell.rm('-f', apexClassMetaPath);
    assert.noFile([apexClassPath, apexClassMetaPath]);
    showInputBoxStub.returns('TestApexClass');
    quickPickStub.returns(outputPath);

    // act
    await apexGenerateClass();

    // assert
    assert.file([apexClassPath, apexClassMetaPath]);
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, apexClassPath);

    sinon.assert.calledOnce(sendCommandEventStub);
    sinon.assert.calledWith(sendCommandEventStub, 'apex_generate_class', sinon.match.array, {
      dirType: 'defaultDir',
      commandExecutor: 'library',
      isUsingCustomOrgMetadataTemplates: 'true'
    });

    // clean up
    shell.rm('-f', apexClassPath);
    shell.rm('-f', apexClassMetaPath);
  });

  it('Should handle error and log telemetry if local template does not exist', async () => {
    // arrange
    getTemplatesDirectoryStub.returns(NON_EXISTENT_LOCAL_PATH);
    const outputPath = 'force-app/main/default/classes';
    const apexClassPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'TestApexClass.cls');
    const apexClassMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'TestApexClass.cls-meta.xml'
    );
    shell.rm('-f', apexClassPath);
    shell.rm('-f', apexClassMetaPath);
    assert.noFile([apexClassPath, apexClassMetaPath]);
    showInputBoxStub.returns('TestApexClass');
    quickPickStub.returns(outputPath);

    // act
    await apexGenerateClass();

    // assert
    const errorMessage = templatesNls.localize('localCustomTemplateDoNotExist', NON_EXISTENT_LOCAL_PATH);
    sinon.assert.calledOnce(appendLineStub);
    sinon.assert.calledWith(appendLineStub, errorMessage);
    sinon.assert.calledOnce(showFailedExecutionStub);
    sinon.assert.calledWith(showFailedExecutionStub, nls.localize('apex_generate_class_text'));
    sinon.assert.calledOnce(sendExceptionStub);
    sinon.assert.calledWith(sendExceptionStub, 'template_create_library', errorMessage);
  });

  it('Should handle error and log telemetry if cannot retrieve default branch', async () => {
    // arrange
    getTemplatesDirectoryStub.returns(NON_EXISTENT_REPO);
    const outputPath = 'force-app/main/default/classes';
    const apexClassPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'TestApexClass.cls');
    const apexClassMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'TestApexClass.cls-meta.xml'
    );
    shell.rm('-f', apexClassPath);
    shell.rm('-f', apexClassMetaPath);
    assert.noFile([apexClassPath, apexClassMetaPath]);
    showInputBoxStub.returns('TestApexClass');
    quickPickStub.returns(outputPath);

    // act
    await apexGenerateClass();

    // assert
    const errorMessage = templatesNls.localize('customTemplatesCannotRetrieveDefaultBranch', NON_EXISTENT_REPO);
    sinon.assert.calledOnce(appendLineStub);
    sinon.assert.calledWith(appendLineStub, errorMessage);
    sinon.assert.calledOnce(showFailedExecutionStub);
    sinon.assert.calledWith(showFailedExecutionStub, nls.localize('apex_generate_class_text'));
    sinon.assert.calledOnce(sendExceptionStub);
    sinon.assert.calledWith(sendExceptionStub, 'template_create_library', errorMessage);
  });

  it('Should create from default template if git repo templates do not have the template type', async () => {
    // arrange
    getTemplatesDirectoryStub.returns(TEST_CUSTOM_TEMPLATES_REPO);
    const fileName = 'testLwc';
    const outputPath = 'force-app/main/default/lwc';
    const lwcHtmlPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.html');
    const lwcJsPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.js');
    const lwcJsMetaPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.js-meta.xml');
    shell.rm('-rf', path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName));
    assert.noFile([lwcHtmlPath, lwcJsPath, lwcJsMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await lightningGenerateLwc();

    // assert
    assert.file([lwcHtmlPath, lwcJsPath, lwcJsMetaPath]);
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, lwcJsPath);

    sinon.assert.calledOnce(sendCommandEventStub);
    sinon.assert.calledWith(sendCommandEventStub, 'lightning_generate_lwc', sinon.match.array, {
      dirType: 'defaultDir',
      commandExecutor: 'library',
      isUsingCustomOrgMetadataTemplates: 'true'
    });

    // clean up
    shell.rm('-rf', path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName));
  });
});
