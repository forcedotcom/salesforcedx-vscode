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
import {
  internalLightningGenerateLwc,
  lightningGenerateLwc
} from '../../../../src/commands/templates';
import { notificationService } from '../../../../src/notifications';
import { SalesforceCoreSettings } from '../../../../src/settings/salesforceCoreSettings';
import { workspaceUtils } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Generate Lightning Web Component', () => {
  let getInternalDevStub: SinonStub;
  let showInputBoxStub: SinonStub;
  let quickPickStub: SinonStub;
  let appendLineStub: SinonStub;
  let showSuccessfulExecutionStub: SinonStub;
  let showFailedExecutionStub: SinonStub;
  let openTextDocumentStub: SinonStub;

  beforeEach(() => {
    getInternalDevStub = stub(
      SalesforceCoreSettings.prototype,
      'getInternalDev'
    );
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

  it('Should generate LWC', async () => {
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
    await lightningGenerateLwc();

    // assert
    const packageJsonPath = path.join('..', '..', '..', '..', 'package.json');
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const extensionsVersion = JSON.parse(packageJsonContent).version as string;
    const firstDotLocation = extensionsVersion.indexOf('.');
    const defaultApiVersion = extensionsVersion.substring(0, firstDotLocation) + '.0';

    assert.file([lwcHtmlPath, lwcJsPath, lwcJsMetaPath]);
    assert.fileContent(lwcHtmlPath, '<template>\n    \n</template>');
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

  it('Should generate internal LWC', async () => {
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
    await internalLightningGenerateLwc(
      vscode.Uri.file(
        path.join(workspaceUtils.getRootWorkspacePath(), outputPath)
      )
    );

    // assert
    assert.file([lwcHtmlPath, lwcJsPath]);
    assert.fileContent(lwcHtmlPath, '<template>\n    \n</template>');
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
