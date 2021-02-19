/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TemplateService } from '@salesforce/templates';
import * as path from 'path';
import * as shell from 'shelljs';
import { SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import * as assert from 'yeoman-assert';
import { channelService } from '../../../../src/channels';
import { forceApexTriggerCreate } from '../../../../src/commands/templates/forceApexTriggerCreate';
import { notificationService } from '../../../../src/notifications';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Apex Trigger Create', () => {
  let showInputBoxStub: SinonStub;
  let quickPickStub: SinonStub;
  let appendLineStub: SinonStub;
  let showSuccessfulExecutionStub: SinonStub;
  let showFailedExecutionStub: SinonStub;

  beforeEach(() => {
    showInputBoxStub = stub(vscode.window, 'showInputBox');
    quickPickStub = stub(vscode.window, 'showQuickPick');
    appendLineStub = stub(channelService, 'appendLine');
    showSuccessfulExecutionStub = stub(
      notificationService,
      'showSuccessfulExecution'
    );
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

  it('Should create Apex Class', async () => {
    // arrange
    const outputPath = 'force-app/main/default/classes';
    const apexTriggerPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'TestApexTrigger.trigger'
    );
    const apexTriggerMetaPath = path.join(
      getRootWorkspacePath(),
      outputPath,
      'TestApexTrigger.trigger-meta.xml'
    );
    shell.rm('-f', apexTriggerPath);
    shell.rm('-f', apexTriggerMetaPath);
    assert.noFile([apexTriggerPath, apexTriggerMetaPath]);
    showInputBoxStub.returns('TestApexTrigger');
    quickPickStub.returns(outputPath);

    // act
    await forceApexTriggerCreate();

    // assert
    const defaultApiVersion = TemplateService.getDefaultApiVersion();
    assert.file([apexTriggerPath, apexTriggerMetaPath]);
    assert.fileContent(
      apexTriggerPath,
      `trigger TestApexTrigger on SOBJECT (before insert) {

}`
    );
    assert.fileContent(
      apexTriggerMetaPath,
      `<?xml version='1.0' encoding='UTF-8'?>
<ApexTrigger xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>${defaultApiVersion}</apiVersion>
  <status>Active</status>
</ApexTrigger>`
    );
  });
});
