/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type Command, TELEMETRY_HEADER } from '@salesforce/salesforcedx-utils';
import * as cross_spawn from 'cross-spawn';
import { CliCommandExecution } from '../../../src/core/cliCommandExecution';
import { CliCommandExecutor } from '../../../src/core/cliCommandExecutor';

jest.mock('cross-spawn');
jest.mock('../../../src/core/cliCommandExecution');
const crossSpawnMocked = jest.mocked(cross_spawn);
const CliCommandExecutorMock = jest.mocked(CliCommandExecution);

describe('CliCommandExecutor Unit Tests.', () => {
  const fakeCommand: Command = {
    command: 'do a thing',
    args: ['arg1', 'arg2'],
    toCommand: jest.fn()
  };
  const options = {
    env: {
      TEST_ENV: 'weAreTestingForSure'
    },
    timeout: 2000
  };

  const patchedOptions = expect.objectContaining({
    timeout: options.timeout,
    env: expect.objectContaining({ TEST_ENV: options.env.TEST_ENV, SFDX_TOOL: TELEMETRY_HEADER })
  });

  it('Should be able to create an instance with the env patched.', () => {
    const cliCommandExecutor = new CliCommandExecutor(fakeCommand, options);
    expect(cliCommandExecutor).toBeInstanceOf(CliCommandExecutor);
    expect((cliCommandExecutor as any).options).toEqual(patchedOptions);
  });

  it('Should be able to execute the command.', () => {
    const fakeChildProcess = {};
    crossSpawnMocked.mockReturnValue(fakeChildProcess as any);
    const cliCommandExecutor = new CliCommandExecutor(fakeCommand, options);
    cliCommandExecutor.execute();
    expect(crossSpawnMocked).toHaveBeenCalledWith(fakeCommand.command, fakeCommand.args, patchedOptions);
    expect(CliCommandExecutorMock).toHaveBeenCalledWith(fakeCommand, fakeChildProcess, undefined);
  });
});
