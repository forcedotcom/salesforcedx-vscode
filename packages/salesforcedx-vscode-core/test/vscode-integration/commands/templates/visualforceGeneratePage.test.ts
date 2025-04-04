/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as fs from 'node:fs';
import * as sinon from 'sinon';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import { visualforceGeneratePage } from '../../../../src/commands/templates';
import { notificationService } from '../../../../src/notifications';
import { workspaceUtils } from '../../../../src/util';

describe('Visualforce Generate Page', () => {
  let showInputBoxStub: SinonStub;
  let quickPickStub: SinonStub;
  let appendLineStub: SinonStub;
  let showSuccessfulExecutionStub: SinonStub;
  let showFailedExecutionStub: SinonStub;
  let openTextDocumentStub: SinonStub;

  beforeEach(() => {
    showInputBoxStub = stub(vscode.window, 'showInputBox');
    quickPickStub = stub(vscode.window, 'showQuickPick');
    appendLineStub = stub(channelService, 'appendLine');
    showSuccessfulExecutionStub = stub(notificationService, 'showSuccessfulExecution');
    showSuccessfulExecutionStub.returns(Promise.resolve());
    showFailedExecutionStub = stub(notificationService, 'showFailedExecution');
    openTextDocumentStub = stub(vscode.workspace, 'openTextDocument');
  });

  afterEach(() => {
    showInputBoxStub.restore();
    quickPickStub.restore();
    showSuccessfulExecutionStub.restore();
    showFailedExecutionStub.restore();
    appendLineStub.restore();
    openTextDocumentStub.restore();
  });

  it('Should generate Visualforce Component', async () => {
    // arrange
    const fileName = 'testVFPage';
    const outputPath = 'force-app/main/default/components';
    const vfPagePath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'testVFPage.page');
    const vfPageMetaPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'testVFPage.page-meta.xml');
    await fs.promises.rm(path.join(vfPagePath), { force: true });
    await fs.promises.rm(path.join(vfPageMetaPath), { force: true });
    assert.noFile([vfPagePath, vfPageMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    visualforceGeneratePage();

    // assert
    assert.file([vfPagePath, vfPageMetaPath]);
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, vfPagePath);

    // clean up
    await fs.promises.rm(path.join(workspaceUtils.getRootWorkspacePath(), outputPath), {
      recursive: true,
      force: true
    });
  });
});
