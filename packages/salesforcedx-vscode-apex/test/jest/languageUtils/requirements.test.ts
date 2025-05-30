/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'node:assert';
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { SET_JAVA_DOC_LINK } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { checkJavaVersion, JAVA_HOME_KEY, resolveRequirements } from '../../../src/requirements';

// Mock find-java-home module
jest.mock('find-java-home', () =>
  jest.fn(callback => {
    // Simulate async behavior
    setTimeout(() => {
      callback(null, '/path/to/java/home');
    }, 0);
  })
);

const jdk = 'openjdk1.8.0.302_8.56.0.22_x64';
const runtimePath = path.join(os.homedir(), 'java_home', 'real', 'jdk', jdk);

describe('Java Requirements Test', () => {
  let sandbox: SinonSandbox;
  let settingStub: SinonStub;
  let execFileStub: SinonStub;

  beforeEach(() => {
    sandbox = createSandbox();
    settingStub = sandbox.stub();
    sandbox.stub(vscode.workspace, 'getConfiguration').withArgs().returns({
      get: settingStub
    });
    sandbox.stub(fs, 'existsSync').resolves(true);
    execFileStub = sandbox.stub(cp, 'execFile');
  });

  afterEach(() => {
    sandbox.restore();
    jest.clearAllMocks();
  });

  // Unix-specific tests
  (process.platform !== 'win32' ? describe : describe.skip)('Unix-specific tests', () => {
    it('Should prevent local java runtime path', async () => {
      const localRuntime = path.join('.', 'java_home', 'dontackmebro');
      settingStub.withArgs(JAVA_HOME_KEY).returns(localRuntime);
      let exceptionThrown = false;
      try {
        await resolveRequirements();
      } catch (err) {
        expect(err).toContain(localRuntime);
        exceptionThrown = true;
      }
      expect(exceptionThrown).toEqual(true);
    });

    it('Should reject when Java binary is not executable', async () => {
      settingStub.withArgs(JAVA_HOME_KEY).returns(runtimePath);
      sandbox.stub(fs.promises, 'access').rejects(new Error('Permission denied'));
      try {
        await resolveRequirements();
        fail('Should have thrown when Java binary is not executable');
      } catch (err) {
        expect(err).toContain('Java binary java at');
        expect(err).toContain('is not executable');
      }
    });
  });

  // Cross-platform tests
  describe('Cross-platform tests', () => {
    it('Should allow valid java runtime path outside the project', async () => {
      settingStub.withArgs(JAVA_HOME_KEY).returns(runtimePath);
      execFileStub.yields('', '', 'java.version = 11.0.0');
      sandbox.stub(fs.promises, 'access').resolves();
      const requirements = await resolveRequirements();
      expect(requirements.java_home).toContain(jdk);
    });

    it('Should not support Java 8', async () => {
      execFileStub.yields('', '', 'java.version = 1.8.0');
      try {
        await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        fail('Should have thrown when the Java version is not supported');
      } catch (err) {
        expect(err).toEqual(nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK));
      }
    });

    it('Should support Java 11', async () => {
      execFileStub.yields('', '', 'java.version = 11.0.0');
      try {
        const result = await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 11.  The error was: ${err}`);
      }
    });

    it('Should support Java 17', async () => {
      execFileStub.yields('', '', 'java.version = 17.2.3');
      try {
        const result = await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 17.  The error was: ${err}`);
      }
    });

    it('Should support Java 21', async () => {
      execFileStub.yields('', '', 'java.version = 21.0.0');
      try {
        const result = await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 21.  The error was: ${err}`);
      }
    });

    it('Should support Java 23', async () => {
      execFileStub.yields('', '', 'java.version = 23.0.0');
      try {
        const result = await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 23.  The error was: ${err}`);
      }
    });

    it('Should reject java version check when execFile fails', async () => {
      execFileStub.yields({ message: 'its broken' }, '', '');
      try {
        await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        fail('Should have thrown when the Java version is not supported');
      } catch (err) {
        const expectedPath = path.join(
          os.homedir(),
          'java_home',
          'bin',
          process.platform === 'win32' ? 'java.exe' : 'java'
        );
        expect(err).toEqual(
          nls.localize(
            'java_version_check_command_failed',
            `${expectedPath} -XshowSettings:properties -version`,
            'its broken'
          )
        );
      }
    });
  });
});
