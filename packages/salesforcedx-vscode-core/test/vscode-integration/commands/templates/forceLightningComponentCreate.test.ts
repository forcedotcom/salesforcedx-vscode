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
  forceInternalLightningComponentCreate,
  forceLightningComponentCreate,
  ForceLightningComponentCreateExecutor
} from '../../../../src/commands/templates/forceLightningComponentCreate';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Lightning Component Create', () => {
  let getInternalDevStub: SinonStub;

  beforeEach(() => {
    getInternalDevStub = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    getInternalDevStub.restore();
  });

  describe('Commands', () => {
    it('Should build the Lightning Component create command', async () => {
      getInternalDevStub.returns(false);
      const lightningCmpCreate = new ForceLightningComponentCreateExecutor();
      const outputDirPath = path.join('force-app', 'main', 'default', 'aura');
      const fileName = 'myAuraCmp';
      const lwcCreateCommand = lightningCmpCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(lwcCreateCommand.toCommand()).to.equal(
        `sfdx force:lightning:component:create --componentname ${fileName} --outputdir ${outputDirPath}`
      );
      expect(lwcCreateCommand.description).to.equal(
        nls.localize('force_lightning_component_create_text')
      );
      expect(lightningCmpCreate.getDefaultDirectory()).to.equal('aura');
      expect(lightningCmpCreate.getFileExtension()).to.equal('.cmp');
      expect(
        lightningCmpCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.cmp')
      ).to.equal(path.join(outputDirPath, fileName, `${fileName}.cmp`));
    });

    it('Should build the internal Lightning Component create command', async () => {
      getInternalDevStub.returns(true);
      const lightningCmpCreate = new ForceLightningComponentCreateExecutor();
      const outputDirPath = path.join('non-dx', 'dir', 'components', 'ns');
      const fileName = 'internalCmp';
      const lwcCreateCommand = lightningCmpCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(lwcCreateCommand.toCommand()).to.equal(
        `sfdx force:lightning:component:create --componentname ${fileName} --outputdir ${outputDirPath} --internal`
      );
      expect(lwcCreateCommand.description).to.equal(
        nls.localize('force_lightning_component_create_text')
      );
      expect(lightningCmpCreate.getDefaultDirectory()).to.equal('aura');
      expect(lightningCmpCreate.getFileExtension()).to.equal('.cmp');
      expect(
        lightningCmpCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.cmp')
      ).to.equal(path.join(outputDirPath, fileName, `${fileName}.cmp`));
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

    it('Should create Aura Component', async () => {
      // arrange
      getInternalDevStub.returns(false);
      const fileName = 'testComponent';
      const outputPath = 'force-app/main/default/aura';
      const auraComponentPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'testComponent',
        'testComponent.cmp'
      );
      const auraComponentMetaPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'testComponent',
        'testComponent.cmp-meta.xml'
      );
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
      assert.noFile([auraComponentPath, auraComponentMetaPath]);
      showInputBoxStub.returns(fileName);
      quickPickStub.returns(outputPath);

      // act
      await forceLightningComponentCreate();

      // assert
      const suffixarray = [
        '.cmp',
        '.cmp-meta.xml',
        '.auradoc',
        '.css',
        'Controller.js',
        'Helper.js',
        'Renderer.js',
        '.svg',
        '.design'
      ];
      for (const suffix of suffixarray) {
        assert.file(
          path.join(
            getRootWorkspacePath(),
            outputPath,
            fileName,
            `${fileName}${suffix}`
          )
        );
      }
      assert.fileContent(
        auraComponentPath,
        '<aura:component>\n\n</aura:component>'
      );
      assert.fileContent(
        auraComponentMetaPath,
        `<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">`
      );
      sinon.assert.calledOnce(openTextDocumentStub);
      sinon.assert.calledWith(openTextDocumentStub, auraComponentPath);

      // clean up
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
    });

    it('Should create internal Aura Component', async () => {
      // arrange
      getInternalDevStub.returns(true);
      const fileName = 'testComponent';
      const outputPath = 'force-app/main/default/aura';
      const auraComponentPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'testComponent',
        'testComponent.cmp'
      );
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
      assert.noFile([auraComponentPath]);
      showInputBoxStub.returns(fileName);
      quickPickStub.returns(outputPath);

      // act
      shell.mkdir('-p', path.join(getRootWorkspacePath(), outputPath));
      await forceInternalLightningComponentCreate(
        vscode.Uri.file(path.join(getRootWorkspacePath(), outputPath))
      );

      // assert
      const suffixarray = [
        '.cmp',
        '.auradoc',
        '.css',
        'Controller.js',
        'Helper.js',
        'Renderer.js',
        '.svg',
        '.design'
      ];
      for (const suffix of suffixarray) {
        assert.file(
          path.join(
            getRootWorkspacePath(),
            outputPath,
            fileName,
            `${fileName}${suffix}`
          )
        );
      }
      assert.fileContent(
        auraComponentPath,
        '<aura:component>\n\n</aura:component>'
      );
      sinon.assert.calledOnce(openTextDocumentStub);
      sinon.assert.calledWith(openTextDocumentStub, auraComponentPath);

      // clean up
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
    });
  });
});
