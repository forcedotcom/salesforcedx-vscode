/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';

import { SpawnOptions } from 'child_process';
import {
  CliCommandExecutor,
  CommandBuilder,
  SfdxCommandBuilder
} from '../../src/cli';

describe('CommandExecutor tests', () => {
  describe('Handle listeners on stdout and stderr', () => {
    it('Should pipe stdout', async () => {
      const execution = new CliCommandExecutor(
        new SfdxCommandBuilder()
          .withArg('force')
          .withArg('--help')
          .build(),
        {}
      ).execute();

      let stdout = '';
      execution.stdoutSubject.subscribe(data => (stdout += data.toString()));
      let stderr = '';
      execution.stderrSubject.subscribe(data => (stderr += data.toString()));
      const exitCode = await new Promise<string>((resolve, reject) => {
        execution.processExitSubject.subscribe(
          data => {
            resolve(data !== undefined ? data.toString() : '');
          },
          err => {
            reject(err);
          }
        );
      });

      expect(exitCode).to.equal('0');
      expect(stdout).to.contain('Usage: sfdx force');
      expect(stderr).to.contain('');
    });

    it('Should pipe stderr', async () => {
      const execution = new CliCommandExecutor(
        new SfdxCommandBuilder()
          .withArg('force')
          .withArg('--unknown')
          .build(),
        {}
      ).execute();

      let stdout = '';
      execution.stdoutSubject.subscribe(data => (stdout += data.toString()));
      let stderr = '';
      execution.stderrSubject.subscribe(data => (stderr += data.toString()));
      const exitCode = await new Promise<string>((resolve, reject) => {
        execution.processExitSubject.subscribe(
          data => {
            resolve(data !== undefined ? data.toString() : '');
          },
          err => {
            reject(err);
          }
        );
      });

      expect(exitCode).to.not.equal('0');
      expect(stdout).to.contain('');
      expect(stderr).to.contain('Unexpected argument --unknown');
    });
  });

  describe('Handle listeners on error', () => {
    it('Should relay error event', async () => {
      const execution = new CliCommandExecutor(
        new CommandBuilder('bogus').build(),
        {}
      ).execute();

      const errorData = await new Promise<string>((resolve, reject) => {
        execution.processErrorSubject.subscribe(
          data => {
            resolve(data !== undefined ? data.toString() : '');
          },
          err => {
            reject(err);
          }
        );
      });

      expect(errorData).to.equal('Error: spawn bogus ENOENT');
    });
  });

  describe('Global CLI Environment', () => {
    const testData = new Map([
      ['key1', 'value1' + process.hrtime()],
      ['key2', 'value2' + process.hrtime()]
    ]);

    it('patchEnv allows patching', async () => {
      class TestableCliCommandExecutor extends CliCommandExecutor {
        public static patchEnv(
          options: SpawnOptions,
          baseEnvironment: Map<string, string>
        ): SpawnOptions {
          return CliCommandExecutor.patchEnv(options, baseEnvironment);
        }
      }

      const patchedOptions = TestableCliCommandExecutor.patchEnv({}, testData);

      expect(patchedOptions).to.have.property('env');
      expect(patchedOptions.env).to.have.property('key1');
      expect(patchedOptions.env.key1).to.equal(testData.get('key1'));
      expect(patchedOptions.env).to.have.property('key2');
      expect(patchedOptions.env.key2).to.equal(testData.get('key2'));
      expect(patchedOptions.env).to.have.any.keys('PATH', 'Path', 'path');
    });

    it('patchEnv does not override exising var', async () => {
      class TestableCliCommandExecutor extends CliCommandExecutor {
        public static patchEnv(
          options: SpawnOptions,
          baseEnvironment: Map<string, string>
        ): SpawnOptions {
          return CliCommandExecutor.patchEnv(options, baseEnvironment);
        }
      }

      const existingKey1Value = 'existing' + process.hrtime();
      const patchedOptions = TestableCliCommandExecutor.patchEnv(
        { env: { key1: existingKey1Value } },
        testData
      );

      expect(patchedOptions).to.have.property('env');
      expect(patchedOptions.env).to.have.property('key1');
      expect(patchedOptions.env.key1).to.equal(existingKey1Value);
      expect(patchedOptions.env).to.have.property('key2');
      expect(patchedOptions.env.key2).to.equal(testData.get('key2'));
    });

    it('patchEnv maintains exising vars', async () => {
      class TestableCliCommandExecutor extends CliCommandExecutor {
        public static patchEnv(
          options: SpawnOptions,
          baseEnvironment: Map<string, string>
        ): SpawnOptions {
          return CliCommandExecutor.patchEnv(options, baseEnvironment);
        }
      }

      const existingValue = 'existing' + process.hrtime();
      const patchedOptions = TestableCliCommandExecutor.patchEnv(
        { env: { keyOrig1: existingValue } },
        testData
      );

      expect(patchedOptions).to.have.property('env');
      expect(patchedOptions.env).to.have.property('key1');
      expect(patchedOptions.env).to.have.property('key2');
      expect(patchedOptions.env).to.have.property('keyOrig1');
      expect(patchedOptions.env.keyOrig1).to.equal(existingValue);
    });
  });
});
