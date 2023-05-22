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
  channelService,
  notificationService,
  SfdxCoreSettings,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';

import {
  forceInternalLightningComponentCreate,
  forceLightningComponentCreate
} from '../../../../src/commands/templates/forceLightningComponentCreate';

// tslint:disable:no-unused-expression
describe('Force Lightning Component Create', () => {
  let getInternalDevStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;
  let quickPickStub: sinon.SinonStub;
  let appendLineStub: sinon.SinonStub;
  let showSuccessfulExecutionStub: sinon.SinonStub;
  let showFailedExecutionStub: sinon.SinonStub;
  let openTextDocumentStub: sinon.SinonStub;

  beforeEach(() => {
    getInternalDevStub = sinon.stub(
      SfdxCoreSettings.prototype,
      'getInternalDev'
    );
    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
    quickPickStub = sinon.stub(vscode.window, 'showQuickPick');
    appendLineStub = sinon.stub(channelService, 'appendLine');
    showSuccessfulExecutionStub = sinon.stub(
      notificationService,
      'showSuccessfulExecution'
    );
    showSuccessfulExecutionStub.returns(Promise.resolve());
    showFailedExecutionStub = sinon.stub(
      notificationService,
      'showFailedExecution'
    );
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

  it('Should create Aura Component', async () => {
    // arrange
    getInternalDevStub.returns(false);
    const fileName = 'testComponent';
    const outputPath = 'force-app/main/default/aura';
    const auraComponentPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testComponent',
      'testComponent.cmp'
    );
    const auraComponentMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testComponent',
      'testComponent.cmp-meta.xml'
    );
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName)
    );
    assert.noFile([auraComponentPath, auraComponentMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await forceLightningComponentCreate();

    // assert
    const suffixarray = [
      '.cmp',
      '.cmp-meta.xml',
      '.auradoc',
      '.css',
      'Controller.js',
      'Helper.js',
      'Renderer.js',
      '.svg',
      '.design'
    ];
    for (const suffix of suffixarray) {
      assert.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          outputPath,
          fileName,
          `${fileName}${suffix}`
        )
      );
    }
    assert.fileContent(
      auraComponentPath,
      '<aura:component>\n\n</aura:component>'
    );
    assert.fileContent(
      auraComponentMetaPath,
      `<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">`
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, auraComponentPath);

    // clean up
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName)
    );
  });

  it('Should create internal Aura Component', async () => {
    // arrange
    getInternalDevStub.returns(true);
    const fileName = 'testComponent';
    const outputPath = 'force-app/main/default/aura';
    const auraComponentPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testComponent',
      'testComponent.cmp'
    );
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName)
    );
    assert.noFile([auraComponentPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    shell.mkdir(
      '-p',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
    );
    await forceInternalLightningComponentCreate(
      vscode.Uri.file(
        path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
      )
    );

    // assert
    const suffixarray = [
      '.cmp',
      '.auradoc',
      '.css',
      'Controller.js',
      'Helper.js',
      'Renderer.js',
      '.svg',
      '.design'
    ];
    for (const suffix of suffixarray) {
      assert.file(
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          outputPath,
          fileName,
          `${fileName}${suffix}`
        )
      );
    }
    assert.fileContent(
      auraComponentPath,
      '<aura:component>\n\n</aura:component>'
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, auraComponentPath);

    // clean up
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName)
    );
  });
});
