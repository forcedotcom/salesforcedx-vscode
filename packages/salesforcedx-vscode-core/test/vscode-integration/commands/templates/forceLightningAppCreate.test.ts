/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as shell from 'shelljs';
import { SinonStub, stub } from 'sinon';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import {
  forceInternalLightningAppCreate,
  forceLightningAppCreate
} from '../../../../src/commands/templates/forceLightningAppCreate';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Lightning App Create', () => {
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

  it('Should create Aura App', async () => {
    // arrange
    getInternalDevStub.returns(false);
    const outputPath = 'force-app/main/default/aura';
    const auraAppPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'testApp',
      'testApp.app'
    );
    const auraAppMetaPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'testApp',
      'testApp.app-meta.xml'
    );
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, 'testApp'));
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
          getRootWorkspacePath(),
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
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, 'testApp'));
  });

  it('Should create internal Aura App', async () => {
    // arrange
    getInternalDevStub.returns(true);
    const outputPath = 'force-app/main/default/aura';
    const auraAppPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'testApp',
      'testApp.app'
    );
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, 'testApp'));
    assert.noFile([auraAppPath]);
    showInputBoxStub.returns('testApp');

    // act
    shell.mkdir('-p', path.join(getRootWorkspacePath(), outputPath));
    await forceInternalLightningAppCreate(
      vscode.Uri.file(path.join(getRootWorkspacePath(), outputPath))
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
          getRootWorkspacePath(),
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
    shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, 'testApp'));
  });
});
