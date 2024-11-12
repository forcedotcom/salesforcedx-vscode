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
  internalLightningGenerateEvent,
  lightningGenerateEvent
} from '../../../../src/commands/templates/lightningGenerateEvent';
import { notificationService } from '../../../../src/notifications';
import { SalesforceCoreSettings } from '../../../../src/settings/salesforceCoreSettings';
import { workspaceUtils } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Lightning Generate Event', () => {
  let getInternalDevStub: SinonStub;
  let showInputBoxStub: SinonStub;
  let quickPickStub: SinonStub;
  let appendLineStub: SinonStub;
  let showSuccessfulExecutionStub: SinonStub;
  let showFailedExecutionStub: SinonStub;
  let openTextDocumentStub: SinonStub;

  beforeEach(() => {
    getInternalDevStub = stub(SalesforceCoreSettings.prototype, 'getInternalDev');
    showInputBoxStub = stub(vscode.window, 'showInputBox');
    quickPickStub = stub(vscode.window, 'showQuickPick');
    appendLineStub = stub(channelService, 'appendLine');
    showSuccessfulExecutionStub = stub(notificationService, 'showSuccessfulExecution');
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

  it('Should generate Aura Event', async () => {
    // arrange
    getInternalDevStub.returns(false);
    const fileName = 'testEvent';
    const outputPath = 'force-app/main/default/aura';
    const auraEventPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testEvent.evt');
    const auraEventMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      fileName,
      'testEvent.evt-meta.xml'
    );
    shell.rm('-rf', path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName));
    assert.noFile([auraEventPath, auraEventMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await lightningGenerateEvent();

    // assert
    assert.file([auraEventPath, auraEventMetaPath]);
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, auraEventPath);

    // clean up
    shell.rm('-rf', path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName));
  });

  it('Should generate internal Aura Event', async () => {
    // arrange
    getInternalDevStub.returns(true);
    const fileName = 'testEvent';
    const outputPath = 'force-app/main/default/aura';
    const auraEventPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testEvent.evt');
    shell.rm('-rf', path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName));
    assert.noFile([auraEventPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    shell.mkdir('-p', path.join(workspaceUtils.getRootWorkspacePath(), outputPath));
    await internalLightningGenerateEvent(vscode.Uri.file(path.join(workspaceUtils.getRootWorkspacePath(), outputPath)));

    // assert
    assert.file([auraEventPath]);
    assert.fileContent(auraEventPath, '<aura:event type="APPLICATION" description="Event template"/>');
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, auraEventPath);

    // clean up
    shell.rm('-rf', path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName));
  });
});
