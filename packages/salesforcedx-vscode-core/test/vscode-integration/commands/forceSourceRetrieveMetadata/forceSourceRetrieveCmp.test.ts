/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import Sinon = require('sinon');
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
  let forceSourceRetrieveStub: SinonStub;
  let openTextDocumentStub: SinonStub;
  let showTextDocumentStub: SinonStub;
  const openAfterRetrieve: boolean = true;

  beforeEach(async () => {
    sb = createSandbox();
    forceSourceRetrieveStub = sb.stub(
      ForceSourceRetrieveExecutor.prototype,
      'execute'
    );
    openTextDocumentStub = sb.stub(vscode.workspace, 'openTextDocument');
    showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
  });

  afterEach(async () => {
    sb.restore();
  });

  it('Should build source retrieve command', async () => {
    const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
      new TestDescriber(),
      openAfterRetrieve
    );
    const forceSourceRetrieveCmd = await forceSourceRetrieveExec.build();
    const response = {
      type: 'CONTINUE',
      data: [
        {
          fileName: 'Test1',
          outputdir: 'force-app/main/default/classes',
          type: 'TestType',
          suffix: 'cls'
        }
      ]
    };
    const exeEesponse = await forceSourceRetrieveExec.execute(response);
    expect(forceSourceRetrieveCmd.toCommand()).to.equal(
      `sfdx force:source:retrieve --json --loglevel fatal -m TestType:Test1`
    );
    expect(forceSourceRetrieveStub.called).to.equal(true);
  });
});
