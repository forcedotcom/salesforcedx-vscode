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
import { SinonStub, stub } from 'sinon';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import {
  forceInternalLightningEventCreate,
  forceLightningEventCreate,
  ForceLightningEventCreateExecutor
} from '../../../../src/commands/templates/forceLightningEventCreate';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Lightning Event Create', () => {
  let getInternalDevStub: SinonStub;

  beforeEach(() => {
    getInternalDevStub = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    getInternalDevStub.restore();
  });

  describe('Commands', () => {
    it('Should build the Lightning Event create command', async () => {
      getInternalDevStub.returns(false);
      const lightningEventCreate = new ForceLightningEventCreateExecutor();
      const outputDirPath = path.join('force-app', 'main', 'default', 'aura');
      const fileName = 'myAuraEvent';
      const lwcCreateCommand = lightningEventCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(lwcCreateCommand.toCommand()).to.equal(
        `sfdx force:lightning:event:create --eventname ${fileName} --outputdir ${outputDirPath}`
      );
      expect(lwcCreateCommand.description).to.equal(
        nls.localize('force_lightning_event_create_text')
      );
      expect(lightningEventCreate.getDefaultDirectory()).to.equal('aura');
      expect(lightningEventCreate.getFileExtension()).to.equal('.evt');
      expect(
        lightningEventCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.evt')
      ).to.equal(path.join(outputDirPath, fileName, `${fileName}.evt`));
    });

    it('Should build the internal Lightning Event create command', async () => {
      getInternalDevStub.returns(true);
      const lightningEventCreate = new ForceLightningEventCreateExecutor();
      const outputDirPath = path.join('non-dx', 'dir', 'components', 'ns');
      const fileName = 'internalEvent';
      const lwcCreateCommand = lightningEventCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(lwcCreateCommand.toCommand()).to.equal(
        `sfdx force:lightning:event:create --eventname ${fileName} --outputdir ${outputDirPath} --internal`
      );
      expect(lwcCreateCommand.description).to.equal(
        nls.localize('force_lightning_event_create_text')
      );
      expect(lightningEventCreate.getDefaultDirectory()).to.equal('aura');
      expect(lightningEventCreate.getFileExtension()).to.equal('.evt');
      expect(
        lightningEventCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.evt')
      ).to.equal(path.join(outputDirPath, fileName, `${fileName}.evt`));
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

    it('Should create Aura Event', async () => {
      // arrange
      getInternalDevStub.returns(false);
      const fileName = 'testEvent';
      const outputPath = 'force-app/main/default/aura';
      const auraEventPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        fileName,
        'testEvent.evt'
      );
      const auraEventMetaPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        fileName,
        'testEvent.evt-meta.xml'
      );
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
      assert.noFile([auraEventPath, auraEventMetaPath]);
      showInputBoxStub.returns(fileName);
      quickPickStub.returns(outputPath);

      // act
      await forceLightningEventCreate();

      // assert
      const defaultApiVersion = TemplateService.getDefaultApiVersion();
      assert.file([auraEventPath, auraEventMetaPath]);
      assert.fileContent(
        auraEventPath,
        '<aura:event type="APPLICATION" description="Event template"/>'
      );
      assert.fileContent(
        auraEventMetaPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${defaultApiVersion}</apiVersion>
    <description>A Lightning Event Bundle</description>
</AuraDefinitionBundle>`
      );
      sinon.assert.calledOnce(openTextDocumentStub);
      sinon.assert.calledWith(openTextDocumentStub, auraEventPath);

      // clean up
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
    });

    it('Should create internal Aura Event', async () => {
      // arrange
      getInternalDevStub.returns(true);
      const fileName = 'testEvent';
      const outputPath = 'force-app/main/default/aura';
      const auraEventPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        fileName,
        'testEvent.evt'
      );
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
      assert.noFile([auraEventPath]);
      showInputBoxStub.returns(fileName);
      quickPickStub.returns(outputPath);

      // act
      shell.mkdir('-p', path.join(getRootWorkspacePath(), outputPath));
      await forceInternalLightningEventCreate(
        vscode.Uri.file(path.join(getRootWorkspacePath(), outputPath))
      );

      // assert
      assert.file([auraEventPath]);
      assert.fileContent(
        auraEventPath,
        '<aura:event type="APPLICATION" description="Event template"/>'
      );
      sinon.assert.calledOnce(openTextDocumentStub);
      sinon.assert.calledWith(openTextDocumentStub, auraEventPath);

      // clean up
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
    });
  });
});
