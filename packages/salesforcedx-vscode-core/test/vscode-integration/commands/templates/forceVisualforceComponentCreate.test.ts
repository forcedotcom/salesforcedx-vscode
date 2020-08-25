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
  forceVisualforceComponentCreate,
  ForceVisualForceComponentCreateExecutor
} from '../../../../src/commands/templates';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Visualforce Component Create', () => {
  describe('Commands', () => {
    it('Should build the Visualforce component create command', async () => {
      const visualforceCmpCreate = new ForceVisualForceComponentCreateExecutor();
      const outputDirPath = path.join(
        'force-app',
        'main',
        'default',
        'components'
      );
      const fileName = 'myVFCmp';
      const vfCmpCreateCommand = visualforceCmpCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(vfCmpCreateCommand.toCommand()).to.equal(
        `sfdx force:visualforce:component:create --componentname ${fileName} --label ${fileName} --outputdir ${outputDirPath}`
      );
      expect(vfCmpCreateCommand.description).to.equal(
        nls.localize('force_visualforce_component_create_text')
      );
      expect(visualforceCmpCreate.getDefaultDirectory()).to.equal('components');
      expect(visualforceCmpCreate.getFileExtension()).to.equal('.component');
      expect(
        visualforceCmpCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.component')
      ).to.equal(path.join(outputDirPath, `${fileName}.component`));
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
      const fileName = 'testVFCmp';
      const outputPath = 'force-app/main/default/components';
      const vfCmpPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'testVFCmp.component'
      );
      const vfCmpMetaPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'testVFCmp.component-meta.xml'
      );
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath));
      assert.noFile([vfCmpPath, vfCmpMetaPath]);
      showInputBoxStub.returns(fileName);
      quickPickStub.returns(outputPath);

      // act
      await forceVisualforceComponentCreate();

      // assert
      const defaultApiVersion = TemplateService.getDefaultApiVersion();
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
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath));
    });
  });
});
