/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TemplateService } from '@salesforce/templates';
import { expect } from 'chai';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import {
  forceVisualforcePageCreate,
  ForceVisualForcePageCreateExecutor
} from '../../../../src/commands/templates';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Visualforce Page Create', () => {
  describe('Commands', () => {
    it('Should build the Visualforce page create command', async () => {
      const visualforcePageCreate = new ForceVisualForcePageCreateExecutor();
      const outputDirPath = path.join('force-app', 'main', 'default', 'pages');
      const fileName = 'myVFPage';
      const vfPageCreateCommand = visualforcePageCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(vfPageCreateCommand.toCommand()).to.equal(
        `sfdx force:visualforce:page:create --pagename ${fileName} --label ${fileName} --outputdir ${outputDirPath}`
      );
      expect(vfPageCreateCommand.description).to.equal(
        nls.localize('force_visualforce_page_create_text')
      );
      expect(visualforcePageCreate.getDefaultDirectory()).to.equal('pages');
      expect(visualforcePageCreate.getFileExtension()).to.equal('.page');
      expect(
        visualforcePageCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.page')
      ).to.equal(path.join(outputDirPath, `${fileName}.page`));
    });
  });

  describe('Library Create', () => {
    let getTemplatesLibraryStub: SinonStub;
    let showInputBoxStub: SinonStub;
    let quickPickStub: SinonStub;
    let appendLineStub: SinonStub;
    let showSuccessfulExecutionStub: SinonStub;
    let showFailedExecutionStub: SinonStub;
    let openTextDocumentStub: SinonStub;

    beforeEach(() => {
      // mock experimental setting
      getTemplatesLibraryStub = stub(
        SfdxCoreSettings.prototype,
        'getTemplatesLibrary'
      );
      getTemplatesLibraryStub.returns(true);
      showInputBoxStub = stub(vscode.window, 'showInputBox');
      quickPickStub = stub(vscode.window, 'showQuickPick');
      appendLineStub = stub(channelService, 'appendLine');
      showSuccessfulExecutionStub = stub(
        notificationService,
        'showSuccessfulExecution'
      );
      showSuccessfulExecutionStub.returns(Promise.resolve());
      showFailedExecutionStub = stub(
        notificationService,
        'showFailedExecution'
      );
      openTextDocumentStub = stub(vscode.workspace, 'openTextDocument');
    });

    afterEach(() => {
      getTemplatesLibraryStub.restore();
      showInputBoxStub.restore();
      quickPickStub.restore();
      showSuccessfulExecutionStub.restore();
      showFailedExecutionStub.restore();
      appendLineStub.restore();
      openTextDocumentStub.restore();
    });

    it('Should create Visualforce Component', async () => {
      // arrange
      const fileName = 'testVFPage';
      const outputPath = 'force-app/main/default/components';
      const vfPagePath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'testVFPage.page'
      );
      const vfPageMetaPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'testVFPage.page-meta.xml'
      );
      shell.rm('-f', path.join(vfPagePath));
      shell.rm('-f', path.join(vfPageMetaPath));
      assert.noFile([vfPagePath, vfPageMetaPath]);
      showInputBoxStub.returns(fileName);
      quickPickStub.returns(outputPath);

      // act
      await forceVisualforcePageCreate();

      // assert
      const defaultApiVersion = TemplateService.getDefaultApiVersion();
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
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath));
    });
  });
});
