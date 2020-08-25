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
  forceAnalyticsTemplateCreate,
  ForceAnalyticsTemplateCreateExecutor
} from '../../../../src/commands/templates/forceAnalyticsTemplateCreate';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Analytics Template Create', () => {
  describe('Command', () => {
    let settings: SinonStub;

    beforeEach(() => {
      settings = stub(SfdxCoreSettings.prototype, 'getInternalDev');
    });

    afterEach(() => {
      settings.restore();
    });

    it('Should build the analytics template create command', async () => {
      settings.returns(false);
      const waveTemplateCreate = new ForceAnalyticsTemplateCreateExecutor();
      const outputDirPath = path.join(
        'force-app',
        'main',
        'default',
        'waveTemplates'
      );
      const sampleTemplateName = 'analyticsTemplate';

      const waveTemplateCreateCommand = waveTemplateCreate.build({
        outputdir: outputDirPath,
        fileName: sampleTemplateName
      });
      expect(waveTemplateCreateCommand.toCommand()).to.equal(
        `sfdx force:analytics:template:create --outputdir ${outputDirPath} --templatename ${sampleTemplateName}`
      );
      expect(waveTemplateCreateCommand.description).to.equal(
        nls.localize('force_analytics_template_create_text')
      );
      expect(waveTemplateCreate.getDefaultDirectory()).to.equal(
        'waveTemplates'
      );
      expect(
        waveTemplateCreate.sourcePathStrategy.getPathToSource(
          outputDirPath,
          sampleTemplateName,
          '.json'
        )
      ).to.equal(
        path.join(outputDirPath, sampleTemplateName, 'template-info.json')
      );
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

    it('Should create Analytics Template', async () => {
      // arrange
      const outputPath = 'force-app/main/default/waveTemplates';
      const templateInfoJsonPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'TestWave',
        'template-info.json'
      );
      const templateFolderJsonPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'TestWave',
        'folder.json'
      );
      const templateDashboardPath = path.join(
        getRootWorkspacePath(),
        outputPath,
        'TestWave/dashboards',
        'TestWaveDashboard.json'
      );
      shell.rm(
        '-rf',
        path.join(getRootWorkspacePath(), outputPath, 'TestWave')
      );
      assert.noFile([
        templateInfoJsonPath,
        templateFolderJsonPath,
        templateDashboardPath
      ]);
      showInputBoxStub.returns('TestWave');
      quickPickStub.returns(outputPath);

      // act
      await forceAnalyticsTemplateCreate();

      // assert
      assert.file([
        templateInfoJsonPath,
        templateFolderJsonPath,
        templateDashboardPath
      ]);
      assert.fileContent(templateInfoJsonPath, '"label": "TestWave"');
      assert.fileContent(templateFolderJsonPath, '"name": "TestWave"');
      assert.fileContent(
        templateDashboardPath,
        '"name": "TestWaveDashboard_tp"'
      );

      // clean up
      shell.rm('-rf', path.join(getRootWorkspacePath(), outputPath));
    });
  });
});
