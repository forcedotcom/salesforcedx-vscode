/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* tslint:disable:no-unused-expression */
import {
  SFDX_DIR,
  SOBJECTS_DIR,
  TOOLS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/constants';
import { ForceConfigGet } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  initSObjectDefinitions,
  SObjectRefreshSource
} from '../../../src/commands/forceGenerateFauxClasses';

describe('Generate faux classes with initSObjectDefinitions', () => {
  let existsSyncStub: sinon.SinonStub;
  let getConfigStub: sinon.SinonStub;
  let executeCommandStub: sinon.SinonStub;
  const commandName = 'sfdx.force.internal.refreshsobjects';
  const projectPath = path.join('sample', 'path');
  const sobjectsPath = path.join(
    projectPath,
    SFDX_DIR,
    TOOLS_DIR,
    SOBJECTS_DIR
  );

  beforeEach(() => {
    existsSyncStub = sinon.stub(fs, 'existsSync');
    getConfigStub = sinon.stub(ForceConfigGet.prototype, 'getConfig');
    executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
  });

  afterEach(() => {
    existsSyncStub.restore();
    getConfigStub.restore();
    executeCommandStub.restore();
  });

  it('Should execute sobject refresh if no sobjects folder is present', async () => {
    existsSyncStub.returns(false);
    getConfigStub.returns(new Map([['defaultusername', 'Sample']]));

    await initSObjectDefinitions(projectPath);

    expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
    expect(executeCommandStub.calledOnce).to.be.true;
    expect(executeCommandStub.getCall(0).args).to.eqls([
      commandName,
      SObjectRefreshSource.STARTUP
    ]);
  });

  it('Should not execute sobject refresh if sobjects folder is present', async () => {
    existsSyncStub.returns(true);
    getConfigStub.returns(new Map([['defaultusername', 'Sample']]));

    await initSObjectDefinitions(projectPath);

    expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
    expect(executeCommandStub.notCalled).to.be.true;
  });

  it('Should not execute sobject refresh if no default username set', async () => {
    existsSyncStub.returns(false);
    getConfigStub.returns(new Map([['defaultusername', undefined]]));

    await initSObjectDefinitions(projectPath);

    expect(executeCommandStub.notCalled).to.be.true;
  });
});
