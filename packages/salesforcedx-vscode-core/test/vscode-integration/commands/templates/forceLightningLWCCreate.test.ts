/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';

import {
    channelService, notificationService, SfdxCoreSettings, workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { TemplateService } from '@salesforce/templates';

import {
    forceInternalLightningLwcCreate, forceLightningLwcCreate
} from '../../../../src/commands/templates';

// tslint:disable:no-unused-expression
describe('Force Lightning Web Component Create', () => {
  let getInternalDevStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;
  let quickPickStub: sinon.SinonStub;
  let appendLineStub: sinon.SinonStub;
  let showSuccessfulExecutionStub: sinon.SinonStub;
  let showFailedExecutionStub: sinon.SinonStub;
  let openTextDocumentStub: sinon.SinonStub;

  beforeEach(() => {
    getInternalDevStub = sinon.stub(SfdxCoreSettings.prototype, 'getInternalDev');
    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
    quickPickStub = sinon.stub(vscode.window, 'showQuickPick');
    appendLineStub = sinon.stub(channelService, 'appendLine');
    showSuccessfulExecutionStub = sinon.stub(
      notificationService,
      'showSuccessfulExecution'
    );
    showSuccessfulExecutionStub.returns(Promise.resolve());
    showFailedExecutionStub = sinon.stub(notificationService, 'showFailedExecution');
    openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument');
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

  it('Should create LWC Component', async () => {
    // arrange
    getInternalDevStub.returns(false);
    const fileName = 'testLwc';
    const outputPath = 'force-app/main/default/lwc';
    const lwcHtmlPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      fileName,
      'testLwc.html'
    );
    const lwcJsPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      fileName,
      'testLwc.js'
    );
    const lwcJsMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      fileName,
      'testLwc.js-meta.xml'
    );
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName)
    );
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

    // clean up
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName)
    );
  });

  it('Should create internal LWC Component', async () => {
    // arrange
    getInternalDevStub.returns(true);
    const fileName = 'testLwc';
    const outputPath = 'force-app/main/default/lwc';
    const lwcHtmlPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      fileName,
      'testLwc.html'
    );
    const lwcJsPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      fileName,
      'testLwc.js'
    );
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName)
    );
    assert.noFile([lwcHtmlPath, lwcJsPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    shell.mkdir(
      '-p',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
    );
    await forceInternalLightningLwcCreate(
      vscode.Uri.file(
        path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
      )
    );

    // assert
    assert.file([lwcHtmlPath, lwcJsPath]);
    assert.fileContent(lwcHtmlPath, `<template>\n    \n</template>`);
    assert.fileContent(
      lwcJsPath,
      `import { LightningElement } from 'lwc';

export default class TestLwc extends LightningElement {}`
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, lwcJsPath);

    // clean up
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName)
    );
  });
});
