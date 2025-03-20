/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import { SFDX_LWC_EXTENSION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import * as sinon from 'sinon';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import { internalLightningGenerateLwc, lightningGenerateLwc } from '../../../../src/commands/templates';
import { LWC_PREVIEW_TYPESCRIPT_SUPPORT } from '../../../../src/commands/util/parameterGatherers';
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
  let settingStub: SinonStub;
  let getConfiguration: SinonStub;

  beforeEach(() => {
    settingStub = stub();
    getInternalDevStub = stub(SalesforceCoreSettings.prototype, 'getInternalDev');
    showInputBoxStub = stub(vscode.window, 'showInputBox');
    quickPickStub = stub(vscode.window, 'showQuickPick');
    appendLineStub = stub(channelService, 'appendLine');
    showSuccessfulExecutionStub = stub(notificationService, 'showSuccessfulExecution');
    showSuccessfulExecutionStub.returns(Promise.resolve());
    showFailedExecutionStub = stub(notificationService, 'showFailedExecution');
    openTextDocumentStub = stub(vscode.workspace, 'openTextDocument');
    getConfiguration = stub(vscode.workspace, 'getConfiguration').withArgs(SFDX_LWC_EXTENSION_NAME).returns({
      get: settingStub
    });
  });

  afterEach(() => {
    getInternalDevStub.restore();
    showInputBoxStub.restore();
    quickPickStub.restore();
    showSuccessfulExecutionStub.restore();
    showFailedExecutionStub.restore();
    appendLineStub.restore();
    openTextDocumentStub.restore();
    getConfiguration.restore();
    settingStub.restore();
  });

  it('Should generate LWC - JavaScript', async () => {
    // arrange
    getInternalDevStub.returns(false);
    settingStub.withArgs(LWC_PREVIEW_TYPESCRIPT_SUPPORT).returns(false);
    const fileName = 'testLwc';
    const outputPath = 'force-app/main/default/lwc';
    const lwcHtmlPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.html');
    const lwcJsPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.js');
    const lwcJsMetaPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.js-meta.xml');
    await fs.promises.rm(path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName), {
      recursive: true,
      force: true
    });
    assert.noFile([lwcHtmlPath, lwcJsPath, lwcJsMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await lightningGenerateLwc();

    // assert
    assert.file([lwcHtmlPath, lwcJsPath, lwcJsMetaPath]);
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, lwcJsPath);

    // clean up
    await fs.promises.rm(path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName), {
      recursive: true,
      force: true
    });
  });

  it('Should generate LWC - TypeScript', async () => {
    // arrange
    getInternalDevStub.returns(false);
    settingStub.withArgs(LWC_PREVIEW_TYPESCRIPT_SUPPORT).returns(true);
    const fileName = 'testLwc';
    const outputPath = 'force-app/main/default/lwc';
    const lwcHtmlPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.html');
    const lwcTsPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.ts');
    const lwcJsMetaPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.js-meta.xml');
    await fs.promises.rm(path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName), {
      recursive: true,
      force: true
    });
    assert.noFile([lwcHtmlPath, lwcTsPath, lwcJsMetaPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await lightningGenerateLwc();

    // assert
    assert.file([lwcHtmlPath, lwcTsPath, lwcJsMetaPath]);
    sinon.assert.calledOnce(openTextDocumentStub);
    sinon.assert.calledWith(openTextDocumentStub, lwcTsPath);

    // clean up
    await fs.promises.rm(path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName), {
      recursive: true,
      force: true
    });
  });

  it('Should generate internal LWC', async () => {
    // arrange
    getInternalDevStub.returns(true);
    settingStub.withArgs(LWC_PREVIEW_TYPESCRIPT_SUPPORT).returns(false);
    const fileName = 'testLwc';
    const outputPath = 'force-app/main/default/lwc';
    const lwcHtmlPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.html');
    const lwcJsPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName, 'testLwc.js');
    await fs.promises.rm(path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName), {
      recursive: true,
      force: true
    });
    assert.noFile([lwcHtmlPath, lwcJsPath]);
    showInputBoxStub.returns(fileName);
    quickPickStub.returns(outputPath);

    // act
    await fs.promises.mkdir(path.join(workspaceUtils.getRootWorkspacePath(), outputPath), { recursive: true });
    await internalLightningGenerateLwc(vscode.Uri.file(path.join(workspaceUtils.getRootWorkspacePath(), outputPath)));

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
    await fs.promises.rm(path.join(workspaceUtils.getRootWorkspacePath(), outputPath, fileName), {
      recursive: true,
      force: true
    });
  });
});
