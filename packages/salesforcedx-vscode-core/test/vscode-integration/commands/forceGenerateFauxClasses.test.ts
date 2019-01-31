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
  forceGenerateFactory,
  initSObjectDefinitions,
  SObjectRefreshSource
} from '../../../src/commands/forceGenerateFauxClasses';

describe('Generate faux classes with initSObjectDefinitions', () => {
  let existsSyncStub: sinon.SinonStub;
  let getConfigStub: sinon.SinonStub;
  let forceGenerateStub: sinon.SinonStub;
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
    forceGenerateStub = sinon.stub(
      forceGenerateFactory,
      'forceGenerateFauxClassesCreate'
    );
  });

  afterEach(() => {
    existsSyncStub.restore();
    getConfigStub.restore();
    forceGenerateStub.restore();
  });

  it('Should execute sobject refresh if no sobjects folder is present', async () => {
    existsSyncStub.returns(false);
    getConfigStub.returns(new Map([['defaultusername', 'Sample']]));

    await initSObjectDefinitions(projectPath);

    expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
    expect(forceGenerateStub.calledOnce).to.be.true;
    expect(forceGenerateStub.getCall(0).args[0]).to.eql(
      SObjectRefreshSource.Startup
    );
  });

  it('Should not execute sobject refresh if sobjects folder is present', async () => {
    existsSyncStub.returns(true);
    getConfigStub.returns(new Map([['defaultusername', 'Sample']]));

    await initSObjectDefinitions(projectPath);

    expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
    expect(forceGenerateStub.notCalled).to.be.true;
  });

  it('Should not execute sobject refresh if no default username set', async () => {
    existsSyncStub.returns(false);
    getConfigStub.returns(new Map([['defaultusername', undefined]]));

    await initSObjectDefinitions(projectPath);

    expect(forceGenerateStub.notCalled).to.be.true;
  });
});
