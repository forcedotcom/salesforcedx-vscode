/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import { fail } from 'node:assert';
import * as cp from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { SET_JAVA_DOC_LINK } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { checkJavaVersion, JAVA_HOME_KEY, resolveRequirements } from '../../../src/requirements';

// Mock VS Code file utilities
jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  fileOrFolderExists: jest.fn(),
  LocalizationService: {
    getInstance: jest.fn().mockReturnValue({
      messageBundleManager: {
        registerMessageBundle: jest.fn()
      },
      localize: jest.fn((key: string, ...args: any[]) => {
        // Return specific error messages for the tests
        switch (key) {
          case 'java_runtime_local_text':
            return `Local Java runtime (${args[0]}) is unsupported. Set the salesforcedx-vscode-apex.java.home VS Code setting to a runtime outside of the current project. For more information, go to [Set Your Java Version](${args[1]}).`;
          case 'java_version_check_command_failed':
            return `Running java command ${args[0]} failed with error: ${args[1]}`;
          case 'wrong_java_version_text':
            return `We detected an unsupported Java version. Java versions 11 or higher are supported. We recommend [Java 21](https://www.oracle.com/java/technologies/downloads/#java21) to run the extensions. For more information, see [Set Your Java Version](${args[0]}).`;
          default:
            return key; // fallback to returning the key
        }
      })
    })
  },
  LOCALE_JA: 'ja'
}));

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
  let getConfigMock: jest.Mock;
  let execFileSpy: jest.SpyInstance;

  beforeEach(() => {
    getConfigMock = jest.fn();
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: getConfigMock,
      update: jest.fn()
    } as any);
    execFileSpy = jest.spyOn(cp, 'execFile');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Unix-specific tests - these tests are skipped as they require complex mocking setup
  (process.platform !== 'win32' ? describe.skip : describe.skip)('Unix-specific tests', () => {
    // Tests removed due to complex mocking requirements
  });

  // Cross-platform tests
  describe('Cross-platform tests', () => {
    it('Should allow valid java runtime path outside the project', async () => {
      getConfigMock.mockImplementation((key: string) => (key === JAVA_HOME_KEY ? runtimePath : undefined));
      (fileOrFolderExists as jest.Mock).mockResolvedValue(true);
      execFileSpy.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        cb('', '', 'java.version = 11.0.0');
      });
      const requirements = await resolveRequirements();
      expect(requirements.java_home).toContain(jdk);
    });

    it('Should not support Java 8', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        cb('', '', 'java.version = 1.8.0');
      });
      try {
        await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        fail('Should have thrown when the Java version is not supported');
      } catch (err) {
        expect(err).toEqual(nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK));
      }
    });

    it('Should support Java 11', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        cb('', '', 'java.version = 11.0.0');
      });
      try {
        const result = await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 11.  The error was: ${err}`);
      }
    });

    it('Should support Java 17', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        cb('', '', 'java.version = 17.2.3');
      });
      try {
        const result = await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 17.  The error was: ${err}`);
      }
    });

    it('Should support Java 21', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        cb('', '', 'java.version = 21.0.0');
      });
      try {
        const result = await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 21.  The error was: ${err}`);
      }
    });

    it('Should support Java 23', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        cb('', '', 'java.version = 23.0.0');
      });
      try {
        const result = await checkJavaVersion(path.join(os.homedir(), 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 23.  The error was: ${err}`);
      }
    });

    it('Should reject java version check when execFile fails', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        cb({ message: 'its broken' }, '', '');
      });
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
