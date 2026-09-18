/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type Command, TELEMETRY_HEADER } from '@salesforce/salesforcedx-utils';
import type crossSpawn from 'cross-spawn';
import { CliCommandExecution } from '../../../src/core/cliCommandExecution';
import { CliCommandExecutor } from '../../../src/core/cliCommandExecutor';

vi.mock('../../../src/core/cliCommandExecution');
const CliCommandExecutorMock = vi.mocked(CliCommandExecution);

describe('CliCommandExecutor Unit Tests.', () => {
  const fakeCommand: Command = {
    command: 'do a thing',
    args: ['arg1', 'arg2'],
    toCommand: vi.fn()
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
    const crossSpawnMock = vi.fn<typeof crossSpawn>().mockReturnValue(fakeChildProcess as any);
    const cliCommandExecutor = new CliCommandExecutor(fakeCommand, options, crossSpawnMock);
    cliCommandExecutor.execute();
    expect(crossSpawnMock).toHaveBeenCalledWith(fakeCommand.command, fakeCommand.args, patchedOptions);
    expect(CliCommandExecutorMock).toHaveBeenCalledWith(fakeCommand, fakeChildProcess, undefined);
  });
});
