/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as shell from 'shelljs';
import { SinonStub, stub } from 'sinon';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import {
  forceInternalLightningAppCreate,
  forceLightningAppCreate,
  ForceLightningAppCreateExecutor
} from '../../../../src/commands/templates/forceLightningAppCreate';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Lightning App Create', () => {
  let getInternalDevStub: SinonStub;

  beforeEach(() => {
    getInternalDevStub = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    getInternalDevStub.restore();
  });

  describe('Commands', () => {
    it('Should build the lightning app create command', async () => {
      getInternalDevStub.returns(false);
      const lightningAppCreate = new ForceLightningAppCreateExecutor();
      const outputDirPath = path.join('force-app', 'main', 'default', 'aura');
      const fileName = 'lightningApp';
      const lightningAppCreateCommand = lightningAppCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(lightningAppCreateCommand.toCommand()).to.equal(
        `sfdx force:lightning:app:create --appname ${fileName} --outputdir ${outputDirPath}`
      );
      expect(lightningAppCreateCommand.description).to.equal(
        nls.localize('force_lightning_app_create_text')
      );
      expect(lightningAppCreate.getDefaultDirectory()).to.equal('aura');
      expect(lightningAppCreate.getFileExtension()).to.equal('.app');
      expect(
        lightningAppCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.app')
      ).to.equal(path.join(outputDirPath, fileName, `${fileName}.app`));
    });

    it('Should build the internal lightning app create command', async () => {
      getInternalDevStub.returns(true);
      const lightningAppCreate = new ForceLightningAppCreateExecutor();
      const outputDirPath = path.join('non-dx', 'dir', 'components', 'ns');
      const fileName = 'lightningInternalApp';
      const lightningAppCreateCommand = lightningAppCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(lightningAppCreateCommand.toCommand()).to.equal(
        `sfdx force:lightning:app:create --appname ${fileName} --outputdir ${outputDirPath} --internal`
      );
      expect(lightningAppCreateCommand.description).to.equal(
        nls.localize('force_lightning_app_create_text')
      );
      expect(lightningAppCreate.getDefaultDirectory()).to.equal('aura');
      expect(lightningAppCreate.getFileExtension()).to.equal('.app');
      expect(
        lightningAppCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.app')
      ).to.equal(path.join(outputDirPath, fileName, `${fileName}.app`));
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
});
