/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { JAVA_HOME_KEY, resolveRequirements } from '../../src/requirements';
import pathExists = require('path-exists');
import * as cp from 'child_process';

const jdk = 'openjdk1.8.0.302_8.56.0.22_x64';
const runtimePath = `~/java_home/real/jdk/${jdk}`;

// TODO: Move this to a new unit test directory

describe('Java Requirements Test', () => {
  let sandbox: SinonSandbox;
  let settingStub: SinonStub;
  let pathExistsStub: SinonStub;
  let execFileStub: SinonStub;

  beforeEach(() => {
    sandbox = createSandbox();
    settingStub = sandbox.stub();
    sandbox
      .stub(vscode.workspace, 'getConfiguration')
      .withArgs()
      .returns({
        get: settingStub
      });
    pathExistsStub = sandbox.stub(pathExists, 'sync').resolves(true);
    execFileStub = sandbox.stub(cp, 'execFile');
  });

  afterEach(() => sandbox.restore());

  it('Should prevent local java runtime path', async () => {
    const localRuntime = './java_home/donthackmebro';
    settingStub.withArgs(JAVA_HOME_KEY).returns('./java_home/donthackmebro');
    let exceptionThrown = false;
    try {
      await resolveRequirements();
    } catch (e) {
      expect(e).contains(localRuntime);
      exceptionThrown = true;
    }
    expect(exceptionThrown).to.be.true;
  });

  it('Should allow valid java runtime path outside the project', async () => {
    settingStub.withArgs(JAVA_HOME_KEY).returns(runtimePath);
    execFileStub.yields('', '', 'build 1.8');
    const requirements = await resolveRequirements();
    expect(requirements.java_home).contains(jdk);
  });

});
