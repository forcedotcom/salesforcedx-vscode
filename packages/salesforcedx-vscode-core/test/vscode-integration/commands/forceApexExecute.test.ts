/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import {
  AnonApexGatherer,
  ApexLibraryExecuteExecutor,
  CreateApexTempFile,
  forceApexExecute,
  ForceApexExecuteExecutor
} from '../../../src/commands/forceApexExecute';
import { sfdxCoreSettings } from '../../../src/settings';
import { getRootWorkspacePath } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('AnonApexGatherer', async () => {
  let sb: SinonSandbox;

  beforeEach(async () => {
    sb = createSandbox();
  });

  afterEach(async () => {
    sb.restore();
  });

  it('should return the selected file to execute anonymous apex', async () => {
    const fileName = path.join(
      getRootWorkspacePath(),
      '.sfdx',
      'tools',
      'tempApex.input'
    );
    const mockActiveTextEditor = {
      document: {
        uri: { fsPath: fileName }
      },
      selection: { isEmpty: true }
    };
    sb.stub(vscode.window, 'activeTextEditor').get(() => {
      return mockActiveTextEditor;
    });

    const fileNameGatherer = new AnonApexGatherer();
    const result = (await fileNameGatherer.gather()) as ContinueResponse<{
      fileName: string;
    }>;
    expect(result.data.fileName).to.equal(fileName);
  });

  it(`should return the currently highlighted 'selection' to execute anonymous apex`, async () => {
    const mockActiveTextEditor = {
      document: {
        getText: (doc: { isEmpty: boolean; text: string }) => doc.text
      },
      selection: { isEmpty: false, text: 'System.assert(true);' }
    };
    sb.stub(vscode.window, 'activeTextEditor').get(() => {
      return mockActiveTextEditor;
    });

    const apexCodeGatherer = new AnonApexGatherer();
    const result = (await apexCodeGatherer.gather()) as ContinueResponse<{
      apexCode: string;
    }>;
    expect(result.data.apexCode).to.equal('System.assert(true);');
  });
});

describe('use CLI Command setting', async () => {
  let sb: SinonSandbox;
  let settingStub: SinonStub;
  let apexExecutorStub: SinonStub;
  let cliExecutorStub: SinonStub;
  let anonGather: SinonStub;
  let apexTempFile: SinonStub;

  beforeEach(async () => {
    sb = createSandbox();
    settingStub = sb.stub(sfdxCoreSettings, 'getApexLibrary');
    apexExecutorStub = sb.stub(ApexLibraryExecuteExecutor.prototype, 'execute');
    cliExecutorStub = sb.stub(ForceApexExecuteExecutor.prototype, 'execute');
    anonGather = sb
      .stub(AnonApexGatherer.prototype, 'gather')
      .returns({ type: 'CONTINUE' } as ContinueResponse<{}>);
    apexTempFile = sb
      .stub(CreateApexTempFile.prototype, 'gather')
      .returns({ type: 'CONTINUE' } as ContinueResponse<{}>);
  });

  afterEach(async () => {
    sb.restore();
  });

  it('should use the ApexLibraryExecuteExecutor if setting is false', async () => {
    settingStub.returns(true);
    await forceApexExecute();
    expect(apexExecutorStub.calledOnce).to.be.true;
    expect(anonGather.calledOnce).to.be.true;
    expect(cliExecutorStub.called).to.be.false;
    expect(apexTempFile.called).to.be.false;
  });

  it('should use the ForceApexExecuteExecutor if setting is true', async () => {
    settingStub.returns(false);
    await forceApexExecute();
    expect(cliExecutorStub.calledOnce).to.be.true;
    expect(apexTempFile.calledOnce).to.be.true;
    expect(apexExecutorStub.called).to.be.false;
    expect(anonGather.called).to.be.false;
  });
});
