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
  forceInternalLightningLwcCreate,
  forceLightningLwcCreate,
  ForceLightningLwcCreateExecutor
} from '../../../../src/commands/templates';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Lightning Web Component Create', () => {
  let getInternalDevStub: SinonStub;

  beforeEach(() => {
    getInternalDevStub = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    getInternalDevStub.restore();
  });

  describe('Commands', () => {
    it('Should build the Lightning Web Component create command', async () => {
      getInternalDevStub.returns(false);
      const lightningLWCCreate = new ForceLightningLwcCreateExecutor();
      const outputDirPath = path.join('force-app', 'main', 'default', 'lwc');
      const fileName = 'myLWC';
      const lwcCreateCommand = lightningLWCCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(lwcCreateCommand.toCommand()).to.equal(
        `sfdx force:lightning:component:create --type lwc --componentname ${fileName} --outputdir ${outputDirPath}`
      );
      expect(lwcCreateCommand.description).to.equal(
        nls.localize('force_lightning_lwc_create_text')
      );
      expect(lightningLWCCreate.getDefaultDirectory()).to.equal('lwc');
      expect(lightningLWCCreate.getFileExtension()).to.equal('.js');
      expect(
        lightningLWCCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.js')
      ).to.equal(path.join(outputDirPath, fileName, `${fileName}.js`));
    });

    it('Should build the internal Lightning Web Component create command', async () => {
      getInternalDevStub.returns(true);
      const lightningLWCCreate = new ForceLightningLwcCreateExecutor();
      const outputDirPath = path.join('non-dx', 'dir', 'components', 'ns');
      const fileName = 'internalLWC';
      const lwcCreateCommand = lightningLWCCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(lwcCreateCommand.toCommand()).to.equal(
        `sfdx force:lightning:component:create --type lwc --componentname ${fileName} --outputdir ${outputDirPath} --internal`
      );
      expect(lwcCreateCommand.description).to.equal(
        nls.localize('force_lightning_lwc_create_text')
      );
      expect(lightningLWCCreate.getDefaultDirectory()).to.equal('lwc');
      expect(lightningLWCCreate.getFileExtension()).to.equal('.js');
      expect(
        lightningLWCCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.js')
      ).to.equal(path.join(outputDirPath, fileName, `${fileName}.js`));
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

    it('Should create LWC Component', async () => {
      // arrange
      getInternalDevStub.returns(false);
      const fileName = 'testLwc';
      const outputPath = 'force-app/main/default/lwc';
      const lwcHtmlPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        fileName,
        'testLwc.html'
      );
      const lwcJsPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        fileName,
        'testLwc.js'
      );
      const lwcJsMetaPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        fileName,
        'testLwc.js-meta.xml'
      );
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
      assert.noFile([lwcHtmlPath, lwcJsPath, lwcJsMetaPath]);
      showInputBoxStub.returns(fileName);
      quickPickStub.returns(outputPath);

      // act
      await forceLightningLwcCreate();

      // assert
      const defaultApiVersion = TemplateService.getDefaultApiVersion();
      assert.file([lwcHtmlPath, lwcJsPath, lwcJsMetaPath]);
      assert.fileContent(lwcHtmlPath, `<template>\n    \n</template>`);
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
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
    });

    it('Should create internal LWC Component', async () => {
      // arrange
      getInternalDevStub.returns(true);
      const fileName = 'testLwc';
      const outputPath = 'force-app/main/default/lwc';
      const lwcHtmlPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        fileName,
        'testLwc.html'
      );
      const lwcJsPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        fileName,
        'testLwc.js'
      );
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
      assert.noFile([lwcHtmlPath, lwcJsPath]);
      showInputBoxStub.returns(fileName);
      quickPickStub.returns(outputPath);

      // act
      shell.mkdir('-p', path.join(getRootWorkspacePath(), outputPath));
      await forceInternalLightningLwcCreate(
        vscode.Uri.file(path.join(getRootWorkspacePath(), outputPath))
      );

      // assert
      assert.file([lwcHtmlPath, lwcJsPath]);
      assert.fileContent(lwcHtmlPath, `<template>\n    \n</template>`);
      assert.fileContent(
        lwcJsPath,
        `import { LightningElement } from 'lwc';

export default class TestLwc extends LightningElement {}`
      );
      sinon.assert.calledOnce(openTextDocumentStub);
      sinon.assert.calledWith(openTextDocumentStub, lwcJsPath);

      // clean up
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath, fileName));
    });
  });
});
