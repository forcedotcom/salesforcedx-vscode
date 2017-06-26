import { expect } from 'chai';

import { CliCommandExecutor, SfdxCommandBuilder } from '../../src/cli';

describe('CommandExecutor tests', () => {
  describe('Handle listeners on stdout and stderr', () => {
    it('Should pipe stdout', async () => {
      const execution = new CliCommandExecutor(
        new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
        {}
      ).execute();

      let stdout = '';
      execution.stdoutSubject.subscribe(data => (stdout += data.toString()));
      let stderr = '';
      execution.stderrSubject.subscribe(data => (stderr += data.toString()));
      const exitCode = await new Promise<string>((resolve, reject) => {
        execution.processExitSubject.subscribe(
          data => {
            resolve(data.toString());
          },
          err => {
            reject(err);
          }
        );
      });

      expect(exitCode).to.equal('0');
      expect(stdout).to.contain(
        'Usage: sfdx COMMAND [command-specific-options]'
      );
      expect(stderr).to.contain('');
    });

    it('Should pipe stderr', async () => {
      const execution = new CliCommandExecutor(
        new SfdxCommandBuilder().withArg('force').withArg('--unknown').build(),
        {}
      ).execute();

      let stdout = '';
      execution.stdoutSubject.subscribe(data => (stdout += data.toString()));
      let stderr = '';
      execution.stderrSubject.subscribe(data => (stderr += data.toString()));
      const exitCode = await new Promise<string>((resolve, reject) => {
        execution.processExitSubject.subscribe(
          data => {
            resolve(data.toString());
          },
          err => {
            reject(err);
          }
        );
      });

      expect(exitCode).to.not.equal('0');
      expect(stdout).to.contain('');
      expect(stderr).to.contain('Error: Unexpected flag --unknown');
    });
  });
});
