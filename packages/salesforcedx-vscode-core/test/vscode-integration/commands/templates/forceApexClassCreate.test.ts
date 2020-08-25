/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TemplateService } from '@salesforce/templates';
import { nls as templatesNls } from '@salesforce/templates/lib/i18n';
import { expect } from 'chai';
import * as path from 'path';
import * as shell from 'shelljs';
import { SinonStub, stub } from 'sinon';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import {
  forceApexClassCreate,
  ForceApexClassCreateExecutor
} from '../../../../src/commands/templates/forceApexClassCreate';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { telemetryService } from '../../../../src/telemetry';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Apex Class Create', () => {
  describe('Command', () => {
    it('Should build the apex class create command', async () => {
      const classCreate = new ForceApexClassCreateExecutor();
      const outputDirPath = path.join(
        'force-app',
        'main',
        'default',
        'classes'
      );
      const fileName = 'myClass';
      const classCreateCommand = classCreate.build({
        fileName,
        outputdir: outputDirPath
      });
      expect(classCreateCommand.toCommand()).to.equal(
        `sfdx force:apex:class:create --classname ${fileName} --template DefaultApexClass --outputdir ${outputDirPath}`
      );
      expect(classCreateCommand.description).to.equal(
        nls.localize('force_apex_class_create_text')
      );
      expect(classCreate.getDefaultDirectory()).to.equal('classes');
      expect(classCreate.getFileExtension()).to.equal('.cls');
      expect(
        classCreate
          .getSourcePathStrategy()
          .getPathToSource(outputDirPath, fileName, '.cls')
      ).to.equal(path.join(outputDirPath, `${fileName}.cls`));
    });
  });

  describe('Library Create', () => {
    let settings: SinonStub;
    let showInputBoxStub: SinonStub;
    let quickPickStub: SinonStub;
    let appendLineStub: SinonStub;
    let showSuccessfulExecutionStub: SinonStub;
    let showFailedExecutionStub: SinonStub;
    let openTextDocumentStub: SinonStub;
    let sendCommandEventStub: SinonStub;
    let sendExceptionStub: SinonStub;

    beforeEach(() => {
      // mock experimental setting
      settings = stub(SfdxCoreSettings.prototype, 'getTemplatesLibrary');
      settings.returns(true);
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
      sendCommandEventStub = stub(telemetryService, 'sendCommandEvent');
      sendExceptionStub = stub(telemetryService, 'sendException');
    });

    afterEach(() => {
      settings.restore();
      showInputBoxStub.restore();
      quickPickStub.restore();
      showSuccessfulExecutionStub.restore();
      showFailedExecutionStub.restore();
      appendLineStub.restore();
      openTextDocumentStub.restore();
      sendCommandEventStub.restore();
      sendExceptionStub.restore();
    });

    it('Should create Apex Class', async () => {
      // arrange
      const outputPath = 'force-app/main/default/classes';
      const apexClassPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'TestApexClass.cls'
      );
      const apexClassMetaPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'TestApexClass.cls-meta.xml'
      );
      shell.rm('-f', apexClassPath);
      shell.rm('-f', apexClassMetaPath);
      assert.noFile([apexClassPath, apexClassMetaPath]);
      showInputBoxStub.returns('TestApexClass');
      quickPickStub.returns(outputPath);

      // act
      await forceApexClassCreate();

      // assert
      const defaultApiVersion = TemplateService.getDefaultApiVersion();
      assert.file([apexClassPath, apexClassMetaPath]);
      assert.fileContent(
        apexClassPath,
        'public with sharing class TestApexClass'
      );
      assert.fileContent(
        apexClassMetaPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${defaultApiVersion}</apiVersion>
    <status>Active</status>
</ApexClass>`
      );
      sinon.assert.calledOnce(openTextDocumentStub);
      sinon.assert.calledWith(openTextDocumentStub, apexClassPath);

      sinon.assert.calledOnce(sendCommandEventStub);
      sinon.assert.calledWith(
        sendCommandEventStub,
        'force_apex_class_create',
        sinon.match.array,
        {
          dirType: 'defaultDir',
          commandExecutor: 'library'
        }
      );

      // clean up
      shell.rm('-f', apexClassPath);
      shell.rm('-f', apexClassMetaPath);
    });

    it('Should handle error and log telemetry for exceptions', async () => {
      // arrange
      const outputPath = 'force-app/main/default/classes';
      showInputBoxStub.returns('?invalid');
      quickPickStub.returns(outputPath);

      // act
      await forceApexClassCreate();

      // assert
      const errorMessage = templatesNls.localize('AlphaNumericNameError');
      sinon.assert.calledOnce(appendLineStub);
      sinon.assert.calledWith(appendLineStub, errorMessage);
      sinon.assert.calledOnce(showFailedExecutionStub);
      sinon.assert.calledWith(
        showFailedExecutionStub,
        nls.localize('force_apex_class_create_text')
      );
      sinon.assert.calledOnce(sendExceptionStub);
      sinon.assert.calledWith(
        sendExceptionStub,
        'force_template_create_library',
        errorMessage
      );
    });
  });
});
