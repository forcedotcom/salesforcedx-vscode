/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import { visualforceGeneratePage } from '../../../../src/commands/templates';
import { notificationService } from '../../../../src/notifications';
import { workspaceUtils } from '../../../../src/util';

// tslint:disable:no-unused-expression
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
    showSuccessfulExecutionStub = stub(
      notificationService,
      'showSuccessfulExecution'
    );
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
    const vfPagePath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testVFPage.page'
    );
    const vfPageMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testVFPage.page-meta.xml'
    );
    shell.rm('-f', path.join(vfPagePath));
    shell.rm('-f', path.join(vfPageMetaPath));
    assert.noFile([vfPagePath, vfPageMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await visualforceGeneratePage();

    // assert
    const packageJsonPath = path.join('..', '..', '..', '..', 'package.json');
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const extensionsVersion = JSON.parse(packageJsonContent).version as string;
    const firstDotLocation = extensionsVersion.indexOf('.');
    const defaultApiVersion = extensionsVersion.substring(0, firstDotLocation) + '.0';

    assert.file([vfPagePath, vfPageMetaPath]);
    assert.fileContent(
      vfPagePath,
      `<apex:page>
<!-- Begin Default Content REMOVE THIS -->
<h1>Congratulations</h1>
This is your new Page
<!-- End Default Content REMOVE THIS -->
</apex:page>`
    );
    assert.fileContent(
      vfPageMetaPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata"> \n    <apiVersion>${defaultApiVersion}</apiVersion>
    <label>testVFPage</label>
</ApexPage>`
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, vfPagePath);

    // clean up
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
    );
  });
});
