/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import { expect } from 'chai';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { SET_JAVA_DOC_LINK } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { checkJavaVersion, JAVA_HOME_KEY, resolveRequirements } from '../../../src/requirements';

const jdk = 'openjdk1.8.0.302_8.56.0.22_x64';
const runtimePath = `~/java_home/real/jdk/${jdk}`;

describe('Java Requirements Test', () => {
  let sandbox: SinonSandbox;
  let settingStub: SinonStub;
  let pathExistsStub: SinonStub;
  let execFileStub: SinonStub;

  beforeEach(() => {
    sandbox = createSandbox();
    settingStub = sandbox.stub();
    sandbox.stub(vscode.workspace, 'getConfiguration').withArgs().returns({
      get: settingStub
    });
    pathExistsStub = sandbox.stub(fs, 'existsSync').resolves(true);
    execFileStub = sandbox.stub(cp, 'execFile');
  });

  afterEach(() => sandbox.restore());

  it('Should prevent local java runtime path', async () => {
    const localRuntime = './java_home/donthackmebro';
    settingStub.withArgs(JAVA_HOME_KEY).returns('./java_home/donthackmebro');
    let exceptionThrown = false;
    try {
      await resolveRequirements();
    } catch (err) {
      expect(err).contains(localRuntime);
      exceptionThrown = true;
    }
    expect(exceptionThrown).to.be.true;
  });

  it('Should allow valid java runtime path outside the project', async () => {
    settingStub.withArgs(JAVA_HOME_KEY).returns(runtimePath);
    execFileStub.yields('', '', 'java.version = 11.0.0');
    const requirements = await resolveRequirements();
    expect(requirements.java_home).contains(jdk);
  });

  it('Should not support Java 8', async () => {
    execFileStub.yields('', '', 'java.version = 1.8.0');
    try {
      await checkJavaVersion('~/java_home');
      fail('Should have thrown when the Java version is not supported');
    } catch (err) {
      expect(err).to.equal(nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK));
    }
  });

  it('Should support Java 11', async () => {
    execFileStub.yields('', '', 'java.version = 11.0.0');
    try {
      const result = await checkJavaVersion('~/java_home');
      expect(result).to.equal(true);
    } catch (err) {
      fail(`Should not have thrown when the Java version is 11.  The error was: ${err}`);
    }
  });

  it('Should support Java 17', async () => {
    execFileStub.yields('', '', 'java.version = 17.2.3');
    try {
      const result = await checkJavaVersion('~/java_home');
      expect(result).to.equal(true);
    } catch (err) {
      fail(`Should not have thrown when the Java version is 17.  The error was: ${err}`);
    }
  });

  it('Should support Java 21', async () => {
    execFileStub.yields('', '', 'java.version = 21.0.0');
    try {
      const result = await checkJavaVersion('~/java_home');
      expect(result).to.equal(true);
    } catch (err) {
      fail(`Should not have thrown when the Java version is 21.  The error was: ${err}`);
    }
  });
  it('Should not support Java 20', async () => {
    execFileStub.yields('', '', 'java.version = 20.0.0');
    try {
      await checkJavaVersion('~/java_home');
      fail('Should have thrown when the Java version is not supported');
    } catch (err) {
      expect(err).to.equal(nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK));
    }
  });

  it('Should reject java version check when execFile fails', async () => {
    execFileStub.yields({ message: 'its broken' }, '', '');
    try {
      await checkJavaVersion(path.join('~', 'java_home'));
      fail('Should have thrown when the Java version is not supported');
    } catch (err) {
      expect(err).to.equal(
        nls.localize(
          'java_version_check_command_failed',
          `${path.join('~', 'java_home', 'bin', 'java')} -XshowSettings:properties -version`,
          'its broken'
        )
      );
    }
  });
});
