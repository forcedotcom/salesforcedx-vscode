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
    });

    afterEach(() => {
      settings.restore();
      showInputBoxStub.restore();
      quickPickStub.restore();
      showSuccessfulExecutionStub.restore();
      showFailedExecutionStub.restore();
      appendLineStub.restore();
    });

    it('Should create Apex Class', async () => {
      // arrange
      showInputBoxStub.returns('TestApexClass');
      quickPickStub.returns('force-app/main/default/classes');
      const apexClassPath = path.join(
        getRootWorkspacePath(),
        'force-app/main/default/classes',
        'TestApexClass.cls'
      );
      const apexClassMetaPath = path.join(
        getRootWorkspacePath(),
        'force-app/main/default/classes',
        'TestApexClass.cls-meta.xml'
      );
      shell.rm('-f', apexClassPath);
      shell.rm('-f', apexClassMetaPath);
      assert.noFile([apexClassPath, apexClassMetaPath]);

      // act
      await forceApexClassCreate();

      // assert
      assert.file([apexClassPath, apexClassMetaPath]);
      assert.fileContent(
        apexClassPath,
        'public with sharing class TestApexClass'
      );
      assert.fileContent(
        apexClassMetaPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>49.0</apiVersion>
    <status>Active</status>
</ApexClass>`
      );
    });
  });
});
