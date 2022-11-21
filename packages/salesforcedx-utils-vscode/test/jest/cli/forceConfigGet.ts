import { ForceConfigGet } from '../../../src';
import { SfdxCommandBuilder } from '../../../src/cli/commandBuilder';
import { CliCommandExecutor } from '../../../src/cli/commandExecutor';
import { CommandOutput } from '../../../src/cli/commandOutput';
import { FORCE_CONFIG_GET_COMMAND } from '../../../src/cli/forceConfigGet';

jest.mock('../../../src/cli/commandExecutor');
jest.mock('../../../src/cli/commandBuilder');
jest.mock('../../../src/cli/CommandOutput');

const SfdxCommandBuilderMock = jest.mocked(SfdxCommandBuilder);
const CommandOutputMock = jest.mocked(CommandOutput);
const CliCommandExecutorMock = jest.mocked(CliCommandExecutor);

describe('forceConfigGet Unit Tests.', () => {
  const fakeProjectPath = '/this/is/a/fake/path';
  const fakeKeyOne = 'one';
  const fakeKeyTwo = 'two';
  const fakeCommandOuput = {
    fake: true
  };

  let withArgsMock: jest.Mock;

  describe('getConfig()', () => {
    beforeEach(() => {
      withArgsMock = jest.fn();
      (SfdxCommandBuilderMock.prototype.withArg as any).mockReturnValue({
        execute: jest.fn().mockReturnValue({ fake: 'execution' }),
        withArg: withArgsMock,
        withJson: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(fakeCommandOuput)
      });
      (SfdxCommandBuilderMock.prototype.withJson as any).mockReturnValue(
        SfdxCommandBuilder.prototype
      );
      (CommandOutputMock.prototype.getCmdResult as any).mockResolvedValue(
        JSON.stringify({
          result: [
            { key: 'one', value: fakeKeyOne },
            { key: 'two', value: fakeKeyTwo }
          ]
        })
      );
    });

    it('Should resolve on success with no keys.', async () => {
      const forceConfigGet = new ForceConfigGet();
      const result = await forceConfigGet.getConfig(fakeProjectPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.get('one')).toEqual(fakeKeyOne);
      expect(result.get('two')).toEqual(fakeKeyTwo);

      expect(SfdxCommandBuilderMock).toHaveBeenCalled();
      const mockSfdxCommandBuilder = SfdxCommandBuilderMock.mock.instances[0];
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledTimes(1);
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledWith(
        FORCE_CONFIG_GET_COMMAND
      );

      expect(CliCommandExecutorMock).toHaveBeenCalledWith(fakeCommandOuput, {
        cwd: fakeProjectPath
      });
      const mockClicCommandExecutor = CliCommandExecutorMock.mock.instances[0];
      expect(mockClicCommandExecutor.execute).toHaveBeenCalled();

      expect(CommandOutputMock).toHaveBeenCalledTimes(1);
      const mockCommandOutput = CommandOutputMock.mock.instances[0];
      expect(mockCommandOutput.getCmdResult).toHaveBeenCalledTimes(1);
    });

    it('Should resolve on success with keys.', async () => {
      const forceConfigGet = new ForceConfigGet();
      const result = await forceConfigGet.getConfig(
        fakeProjectPath,
        'key1',
        'key2',
        'key3'
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.get('one')).toEqual(fakeKeyOne);
      expect(result.get('two')).toEqual(fakeKeyTwo);

      expect(SfdxCommandBuilderMock).toHaveBeenCalled();
      const mockSfdxCommandBuilder = SfdxCommandBuilderMock.mock.instances[0];
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledTimes(1);
      expect(withArgsMock).toHaveBeenCalledTimes(3);
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledWith(
        FORCE_CONFIG_GET_COMMAND
      );

      expect(CliCommandExecutorMock).toHaveBeenCalledWith(fakeCommandOuput, {
        cwd: fakeProjectPath
      });
      const mockClicCommandExecutor = CliCommandExecutorMock.mock.instances[0];
      expect(mockClicCommandExecutor.execute).toHaveBeenCalled();

      expect(CommandOutputMock).toHaveBeenCalledTimes(1);
      const mockCommandOutput = CommandOutputMock.mock.instances[0];
      expect(mockCommandOutput.getCmdResult).toHaveBeenCalledTimes(1);
    });

    it('Should reject if unable to parse json.', async () => {
      (CommandOutputMock.prototype.getCmdResult as any).mockResolvedValue(
        '{so:not:value:json}'
      );

      const forceConfigGet = new ForceConfigGet();
      expect(forceConfigGet.getConfig(fakeProjectPath)).rejects.toThrowError(
        'Unexpected token'
      );
    });
  });
});
