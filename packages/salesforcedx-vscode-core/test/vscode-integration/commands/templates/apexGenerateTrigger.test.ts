/*
 * Copyright (c) 2017, salesforce.com, inc.
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
import { apexGenerateTrigger } from '../../../../src/commands/templates/apexGenerateTrigger';
import { notificationService } from '../../../../src/notifications';
import { workspaceUtils } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Apex Generate Trigger', () => {
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

  it('Should generate Apex Trigger', async () => {
    // arrange
    const outputPath = 'force-app/main/default/triggers';
    const apexTriggerPath = path.join(workspaceUtils.getRootWorkspacePath(), outputPath, 'TestApexTrigger.trigger');
    const apexTriggerMetaPath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputPath,
      'TestApexTrigger.trigger-meta.xml'
    );
    shell.rm('-f', apexTriggerPath);
    shell.rm('-f', apexTriggerMetaPath);
    assert.noFile([apexTriggerPath, apexTriggerMetaPath]);
    showInputBoxStub.returns('TestApexTrigger');
    quickPickStub.returns(outputPath);

    // act
    await apexGenerateTrigger();

    // assert
    assert.file([apexTriggerPath, apexTriggerMetaPath]);
  });
});
