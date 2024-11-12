/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as shell from 'shelljs';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import { analyticsGenerateTemplate } from '../../../../src/commands/templates/analyticsGenerateTemplate';
import { notificationService } from '../../../../src/notifications';
import { workspaceUtils } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Analytics Generate Template', () => {
  let showInputBoxStub: SinonStub;
  let quickPickStub: SinonStub;
  let appendLineStub: SinonStub;
  let showSuccessfulExecutionStub: SinonStub;
  let showFailedExecutionStub: SinonStub;

  beforeEach(() => {
    showInputBoxStub = stub(vscode.window, 'showInputBox');
    quickPickStub = stub(vscode.window, 'showQuickPick');
    appendLineStub = stub(channelService, 'appendLine');
    showSuccessfulExecutionStub = stub(notificationService, 'showSuccessfulExecution');
    showSuccessfulExecutionStub.returns(Promise.resolve());
    showFailedExecutionStub = stub(notificationService, 'showFailedExecution');
  });

  afterEach(() => {
    showInputBoxStub.restore();
    quickPickStub.restore();
    showSuccessfulExecutionStub.restore();
    showFailedExecutionStub.restore();
    appendLineStub.restore();
  });

  it('Should generate Analytics Template', async () => {
    // arrange
    const outputPath = 'force-app/main/default/waveTemplates';
    const templateInfoJsonPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'TestWave',
      'template-info.json'
    );
    const templateFolderJsonPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'TestWave',
      'folder.json'
    );
    const templateDashboardPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'TestWave/dashboards',
      'TestWaveDashboard.json'
    );
    shell.rm('-rf', path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'TestWave'));
    assert.noFile([templateInfoJsonPath, templateFolderJsonPath, templateDashboardPath]);
    showInputBoxStub.returns('TestWave');
    quickPickStub.returns(outputPath);

    // act
    await analyticsGenerateTemplate();

    // assert
    assert.file([templateInfoJsonPath, templateFolderJsonPath, templateDashboardPath]);
    assert.fileContent(templateInfoJsonPath, '"label": "TestWave"');
    assert.fileContent(templateFolderJsonPath, '"name": "TestWave"');
    assert.fileContent(templateDashboardPath, '"name": "TestWaveDashboard_tp"');

    // clean up
    shell.rm('-rf', path.join(workspaceUtils.getRootWorkspacePath(), outputPath));
  });
});
