/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TemplateService } from '@salesforce/templates';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import {
  forceInternalLightningInterfaceCreate,
  forceLightningInterfaceCreate
} from '../../../../src/commands/templates/forceLightningInterfaceCreate';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Lightning Interface Create', () => {
  let getInternalDevStub: SinonStub;
  let showInputBoxStub: SinonStub;
  let quickPickStub: SinonStub;
  let appendLineStub: SinonStub;
  let showSuccessfulExecutionStub: SinonStub;
  let showFailedExecutionStub: SinonStub;
  let openTextDocumentStub: SinonStub;

  beforeEach(() => {
    getInternalDevStub = stub(SfdxCoreSettings.prototype, 'getInternalDev');
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
  });

  afterEach(() => {
    getInternalDevStub.restore();
    showInputBoxStub.restore();
    quickPickStub.restore();
    showSuccessfulExecutionStub.restore();
    showFailedExecutionStub.restore();
    appendLineStub.restore();
    openTextDocumentStub.restore();
  });

  it('Should create Aura Interface', async () => {
    // arrange
    getInternalDevStub.returns(false);
    const fileName = 'testInterface';
    const outputPath = 'force-app/main/default/aura';
    const auraInterfacePath = path.join(
      getRootWorkspacePath(),
      outputPath,
      fileName,
      'testInterface.intf'
    );
    const auraInterfaceMetaPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      fileName,
      'testInterface.intf-meta.xml'
    );
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
    assert.noFile([auraInterfacePath, auraInterfaceMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await forceLightningInterfaceCreate();

    // assert
    const defaultApiVersion = TemplateService.getDefaultApiVersion();
    assert.file([auraInterfacePath, auraInterfaceMetaPath]);
    assert.fileContent(
      auraInterfacePath,
      `<aura:interface description="Interface template">
  <aura:attribute name="example" type="String" default="" description="An example attribute."/>
</aura:interface>`
    );
    assert.fileContent(
      auraInterfaceMetaPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${defaultApiVersion}</apiVersion>
    <description>A Lightning Interface Bundle</description>
</AuraDefinitionBundle>`
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, auraInterfacePath);

    // clean up
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
  });

  it('Should create internal Aura Interface', async () => {
    // arrange
    getInternalDevStub.returns(true);
    const fileName = 'testInterface';
    const outputPath = 'force-app/main/default/aura';
    const auraInterfacePath = path.join(
      getRootWorkspacePath(),
      outputPath,
      fileName,
      'testInterface.intf'
    );
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
    assert.noFile([auraInterfacePath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    shell.mkdir('-p', path.join(getRootWorkspacePath(), outputPath));
    await forceInternalLightningInterfaceCreate(
      vscode.Uri.file(path.join(getRootWorkspacePath(), outputPath))
    );

    // assert
    assert.file([auraInterfacePath]);
    assert.fileContent(
      auraInterfacePath,
      `<aura:interface description="Interface template">
  <aura:attribute name="example" type="String" default="" description="An example attribute."/>
</aura:interface>`
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, auraInterfacePath);

    // clean up
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
  });
});
