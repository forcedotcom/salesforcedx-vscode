/*
 * Copyright (c) 2019, salesforce.com, inc.
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
import { apexGenerateClass } from '../../../../src/commands/templates/apexGenerateClass';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';
import { workspaceUtils } from '../../../../src/util';

const sandbox = createSandbox();

// tslint:disable:no-unused-expression
describe('Apex Generate Class', () => {
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
    showSuccessfulExecutionStub = sandbox.stub(notificationService, 'showSuccessfulExecution').resolves();
    showFailedExecutionStub = sandbox.stub(notificationService, 'showFailedExecution');
    openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument');
    sendCommandEventStub = sandbox.stub(telemetryService, 'sendCommandEvent');
    sendExceptionStub = sandbox.stub(telemetryService, 'sendException');
    getTemplatesDirectoryStub = sandbox.stub(ConfigUtil, 'getTemplatesDirectory').returns(undefined);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should generate Apex Class', async () => {
    // arrange
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
      isUsingCustomOrgMetadataTemplates: 'false'
    });

    // clean up
    shell.rm('-f', apexClassPath);
    shell.rm('-f', apexClassMetaPath);
  });

  it('Should handle error and log telemetry for exceptions', async () => {
    // arrange
    const outputPath = 'force-app/main/default/classes';
    showInputBoxStub.returns('?invalid');
    quickPickStub.returns(outputPath);

    // act
    await apexGenerateClass();

    // assert
    const errorMessage = templatesNls.localize('AlphaNumericNameError');
    sinon.assert.calledOnce(appendLineStub);
    sinon.assert.calledWith(appendLineStub, errorMessage);
    sinon.assert.calledOnce(showFailedExecutionStub);
    sinon.assert.calledWith(showFailedExecutionStub, nls.localize('apex_generate_class_text'));
    sinon.assert.calledOnce(sendExceptionStub);
    sinon.assert.calledWith(sendExceptionStub, 'template_create_library', errorMessage);
  });
});
