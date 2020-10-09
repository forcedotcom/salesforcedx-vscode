/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  CommandOutput
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { RetrieveDescriber } from '../../../../src/commands/forceSourceRetrieveMetadata';
import { ForceSourceRetrieveExecutor } from '../../../../src/commands/forceSourceRetrieveMetadata/forceSourceRetrieveCmp';

class TestDescriber implements RetrieveDescriber {
  public buildMetadataArg(data?: LocalComponent[]): string {
    return data ? `${data[0].type}:${data[0].fileName}` : 'TestType:Test1';
  }

  public gatherOutputLocations(): Promise<LocalComponent[]> {
    throw new Error('Method not implemented.');
  }
}

describe('Force Source Retrieve', () => {
  const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
    new TestDescriber()
  );
  it('Should build source retrieve command', async () => {
    const forceSourceRetrieveCmd = forceSourceRetrieveExec.build();
    expect(forceSourceRetrieveCmd.toCommand()).to.equal(
      `sfdx force:source:retrieve --json --loglevel fatal -m TestType:Test1`
    );
  });

  it('Should pass optional data to describer', () => {
    const data = [{ fileName: 'Test2', outputdir: '', type: 'TestType2' }];
    const forceSourceRetrieveCmd = forceSourceRetrieveExec.build(data);
    expect(forceSourceRetrieveCmd.toCommand()).to.equal(
      `sfdx force:source:retrieve --json --loglevel fatal -m TestType2:Test2`
    );
  });
});

describe('Force Source Retrieve and open', () => {
  let sb: SinonSandbox;
  const openAfterRetrieve: boolean = true;
  const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
    new TestDescriber(),
    openAfterRetrieve
  );
  let openTextDocumentStub: SinonStub;
  let showTextDocumentStub: SinonStub;
  const resultData = `{
    "status": 0,
    "result": {
      "inboundFiles": [
        {
          "state": "Add",
          "fullName": "TestClass",
          "type": "ApexClass",
          "filePath": "force-app/main/default/classes/TestClass.cls"}
  ] }}`;
  let getCmdResultStub: SinonStub;

  beforeEach(() => {
    sb = createSandbox();
    openTextDocumentStub = sb.stub(vscode.workspace, 'openTextDocument');
    showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
    getCmdResultStub = sb
      .stub(CommandOutput.prototype, 'getCmdResult')
      .returns(resultData);
  });

  afterEach(() => {
    sb.restore();
  });

  it('Should build source retrieve command', async () => {
    const response = [
      {
        type: 'CONTINUE',
        data: [
          {
            fileName: 'DemoController',
            outputdir:
              '/Users/testUser/testProject/force-app/main/default/classes/DemoController.cls',
            type: 'ApexClass',
            suffix: 'cls'
          }
        ]
      }
    ];
    const exeEesponse = await forceSourceRetrieveExec.execute(response);
    expect(getCmdResultStub.called).to.equal(true);
    expect(openTextDocumentStub.called).to.equal(true);
    expect(showTextDocumentStub.called).to.equal(true);
  });
});
