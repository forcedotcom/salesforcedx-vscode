/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execSync } from 'child_process';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import { visualforceGenerateComponent } from '../../../../src/commands/templates';
import { notificationService } from '../../../../src/notifications';
import { workspaceUtils } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Visualforce Generate Component', () => {
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
    const fileName = 'testVFCmp';
    const outputPath = 'force-app/main/default/components';
    const vfCmpPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testVFCmp.component'
    );
    const vfCmpMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'testVFCmp.component-meta.xml'
    );
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
    );
    assert.noFile([vfCmpPath, vfCmpMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await visualforceGenerateComponent();

    // assert
    const packageJsonPath = path.join('..', '..', '..', '..', 'package.json');
    const result = execSync(`cat ${packageJsonPath}`).toString();
    const extensionsVersion = JSON.parse(result).version as string;
    const firstDotLocation = extensionsVersion.indexOf('.');
    const defaultApiVersion = extensionsVersion.substring(0, firstDotLocation) + '.0';

    assert.file([vfCmpPath, vfCmpMetaPath]);
    assert.fileContent(
      vfCmpPath,
      `<apex:component>
<!-- Begin Default Content REMOVE THIS -->
<h1>Congratulations</h1>
This is your new Component
<!-- End Default Content REMOVE THIS -->
</apex:component>`
    );
    assert.fileContent(
      vfCmpMetaPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<ApexComponent xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${defaultApiVersion}</apiVersion>
    <label>testVFCmp</label>
</ApexComponent>`
    );
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, vfCmpPath);

    // clean up
    shell.rm(
      '-rf',
      path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
    );
  });
});
