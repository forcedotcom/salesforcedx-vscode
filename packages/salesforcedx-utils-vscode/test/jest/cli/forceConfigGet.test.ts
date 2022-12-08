import { ForceConfigGet } from '../../../src';
import { SfdxCommandBuilder } from '../../../src/cli/commandBuilder';
import { CliCommandExecutor } from '../../../src/cli/commandExecutor';
import { CommandOutput } from '../../../src/cli/commandOutput';
import { FORCE_CONFIG_GET_COMMAND } from '../../../src/cli/forceConfigGet';

jest.mock('../../../src/cli/commandExecutor');
jest.mock('../../../src/cli/commandBuilder');
jest.mock('../../../src/cli/commandOutput');

const sfdxCommandBuilderMock = jest.mocked(SfdxCommandBuilder);
const commandOutputMock = jest.mocked(CommandOutput);
const cliCommandExecutorMock = jest.mocked(CliCommandExecutor);

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
      (sfdxCommandBuilderMock.prototype.withArg as any).mockReturnValue({
        execute: jest.fn().mockReturnValue({ fake: 'execution' }),
        withArg: withArgsMock,
        withJson: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(fakeCommandOuput)
      });
      (sfdxCommandBuilderMock.prototype.withJson as any).mockReturnValue(
        SfdxCommandBuilder.prototype
      );
      (commandOutputMock.prototype.getCmdResult as any).mockResolvedValue(
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

      expect(sfdxCommandBuilderMock).toHaveBeenCalled();
      const mockSfdxCommandBuilder = sfdxCommandBuilderMock.mock.instances[0];
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledTimes(1);
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledWith(
        FORCE_CONFIG_GET_COMMAND
      );

      expect(cliCommandExecutorMock).toHaveBeenCalledWith(fakeCommandOuput, {
        cwd: fakeProjectPath
      });
      const mockClicCommandExecutor = cliCommandExecutorMock.mock.instances[0];
      expect(mockClicCommandExecutor.execute).toHaveBeenCalled();

      expect(commandOutputMock).toHaveBeenCalledTimes(1);
      const mockCommandOutput = commandOutputMock.mock.instances[0];
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

      expect(sfdxCommandBuilderMock).toHaveBeenCalled();
      const mockSfdxCommandBuilder = sfdxCommandBuilderMock.mock.instances[0];
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledTimes(1);
      expect(withArgsMock).toHaveBeenCalledTimes(3);
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledWith(
        FORCE_CONFIG_GET_COMMAND
      );

      expect(cliCommandExecutorMock).toHaveBeenCalledWith(fakeCommandOuput, {
        cwd: fakeProjectPath
      });
      const mockClicCommandExecutor = cliCommandExecutorMock.mock.instances[0];
      expect(mockClicCommandExecutor.execute).toHaveBeenCalled();

      expect(commandOutputMock).toHaveBeenCalledTimes(1);
      const mockCommandOutput = commandOutputMock.mock.instances[0];
      expect(mockCommandOutput.getCmdResult).toHaveBeenCalledTimes(1);
    });

    it('Should reject if unable to parse json.', async () => {
      (commandOutputMock.prototype.getCmdResult as any).mockResolvedValue(
        '{so:not:value:json}'
      );

      const forceConfigGet = new ForceConfigGet();
      // tslint:disable-next-line:no-floating-promises
      expect(forceConfigGet.getConfig(fakeProjectPath)).rejects.toThrowError(
        /Unexpected token/
      );
    });
  });
});
