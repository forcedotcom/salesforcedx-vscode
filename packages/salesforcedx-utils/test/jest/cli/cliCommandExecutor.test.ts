import * as cross_spawn from 'cross-spawn';
import { CliCommandExecutor, Command, TELEMETRY_HEADER } from '../../../src';
import { CliCommandExecution } from '../../../src/cli/cliCommandExecution';
import { GlobalCliEnvironment } from '../../../src/cli/globalCliEnvironment';
jest.mock('cross-spawn');
jest.mock('../../../src/cli/cliCommandExecution');
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

  const globalKey = 'globalKey';
  const globalValue = 'totallyTrue';

  beforeEach(() => {
    // Add a global value to the GCE option for processing during creation.
    GlobalCliEnvironment.environmentVariables.set(globalKey, globalValue);
  });

  it('Should be able to create an instance.', () => {
    const cliCommandExecutor = new CliCommandExecutor(
      fakeCommand,
      options,
      false
    );
    expect(cliCommandExecutor).toBeInstanceOf(CliCommandExecutor);
  });

  it('Should be able to include global env.', () => {
    const cliCommandExecutor = new CliCommandExecutor(
      fakeCommand,
      options,
      true
    );
    const populatedOptions = (cliCommandExecutor as any).options;
    expect(populatedOptions.env).toEqual(
      expect.objectContaining({
        globalKey: globalValue,
        TEST_ENV: options.env.TEST_ENV,
        SFDX_TOOL: TELEMETRY_HEADER
      })
    );
    expect(populatedOptions.timeout).toEqual(options.timeout);
  });

  it('Should be able to execute the command.', () => {
    const fakeChildProcess = {};
    crossSpawnMocked.mockReturnValue(fakeChildProcess as any);
    const cliCommandExecutor = new CliCommandExecutor(
      fakeCommand,
      options,
      false
    );
    cliCommandExecutor.execute();
    expect(crossSpawnMocked).toHaveBeenCalledWith(
      fakeCommand.command,
      fakeCommand.args,
      options
    );
    expect(CliCommandExecutorMock).toHaveBeenCalledWith(
      fakeCommand,
      fakeChildProcess,
      undefined
    );
  });
});
