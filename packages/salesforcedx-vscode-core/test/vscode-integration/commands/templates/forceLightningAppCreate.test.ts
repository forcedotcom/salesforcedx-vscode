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

import {
    forceInternalLightningAppCreate, forceLightningAppCreate
} from '../../../../src/commands/templates/forceLightningAppCreate';

// tslint:disable:no-unused-expression
describe('Force Lightning App Create', () => {
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

  it('Should create Aura App', async () => {
    // arrange
    getInternalDevStub.returns(false);
    const outputPath = 'force-app/main/default/aura';
    const auraAppPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testApp',
      'testApp.app'
    );
    const auraAppMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testApp',
      'testApp.app-meta.xml'
    );
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'testApp')
    );
    assert.noFile([auraAppPath, auraAppMetaPath]);
    showInputBoxStub.returns('testApp');
    quickPickStub.returns(outputPath);

    // act
    await forceLightningAppCreate();

    // assert
    const suffixarray = [
      '.app',
      '.app-meta.xml',
      '.auradoc',
      '.css',
      'Controller.js',
      'Helper.js',
      'Renderer.js',
      '.svg'
    ];
    for (const suffix of suffixarray) {
      assert.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          outputPath,
          'testApp',
          `testApp${suffix}`
        )
      );
    }
    assert.fileContent(
      auraAppPath,
      '<aura:application>\n\n</aura:application>'
    );
    assert.fileContent(
      auraAppMetaPath,
      `<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">`
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, auraAppPath);

    // clean up
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'testApp')
    );
  });

  it('Should create internal Aura App', async () => {
    // arrange
    getInternalDevStub.returns(true);
    const outputPath = 'force-app/main/default/aura';
    const auraAppPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testApp',
      'testApp.app'
    );
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'testApp')
    );
    assert.noFile([auraAppPath]);
    showInputBoxStub.returns('testApp');

    // act
    shell.mkdir(
      '-p',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
    );
    await forceInternalLightningAppCreate(
      vscode.Uri.file(
        path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
      )
    );

    // assert
    const suffixarray = [
      '.app',
      '.auradoc',
      '.css',
      'Controller.js',
      'Helper.js',
      'Renderer.js',
      '.svg'
    ];
    for (const suffix of suffixarray) {
      assert.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          outputPath,
          'testApp',
          `testApp${suffix}`
        )
      );
    }
    assert.fileContent(
      auraAppPath,
      '<aura:application>\n\n</aura:application>'
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, auraAppPath);

    // clean up
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'testApp')
    );
  });
});
