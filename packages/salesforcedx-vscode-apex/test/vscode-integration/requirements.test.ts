/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import { fail } from 'assert';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { SET_JAVA_DOC_LINK } from '../../src/constants';
import { nls } from '../../src/messages';
import { JAVA_HOME_KEY, resolveRequirements, checkJavaVersion } from '../../src/requirements';
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

  it('Should support Java 8', async () => {
    execFileStub.yields('', '', 'build 1.8.0');
    checkJavaVersion('~/java_home')
      .then(result => {
        expect(result).to.equal(true);
      }).catch(error => {
        fail(`Should not have thrown when the Java version is 8.  The error was: ${error.message}`);
      });
  });

  it('Should support Java 11', async () => {
    execFileStub.yields('', '', 'build 11.0.0');
    checkJavaVersion('~/java_home')
      .then(result => {
        expect(result).to.equal(true);
      }).catch(error => {
        fail(`Should not have thrown when the Java version is 11.  The error was: ${error.message}`);
      });
  });

  it('Should support Java 17', async () => {
    execFileStub.yields('', '', 'build 17.2.3');
    checkJavaVersion('~/java_home')
      .then(result => {
        expect(result).to.equal(true);
      }).catch(error => {
        fail(`Should not have thrown when the Java version is 17.  The error was: ${error.message}`);
      });
  });

  it('Should not support Java 20', async () => {
    execFileStub.yields('', '', 'build 20.0.0');
    checkJavaVersion('~/java_home')
      .then(() => {
        fail('Should have thrown when the Java version is not supported');
      }).catch(error => {
        expect(error.message).to.equal(
          nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK)
        );
      });
  });
});
