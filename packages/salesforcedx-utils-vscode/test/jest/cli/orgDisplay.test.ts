import { SfdxCommandBuilder } from '../../../src/cli/commandBuilder';
import { CliCommandExecutor } from '../../../src/cli/commandExecutor';
import { CommandOutput } from '../../../src/cli/commandOutput';
import {
  ORG_DISPLAY_COMMAND,
  OrgDisplay,
  OrgInfo
} from '../../../src/cli/orgDisplay';

jest.mock('../../../src/cli/commandExecutor');
jest.mock('../../../src/cli/commandBuilder');
jest.mock('../../../src/cli/commandOutput');

const sfdxCommandBuilderMock = jest.mocked(SfdxCommandBuilder);
const commandOutputMock = jest.mocked(CommandOutput);
const cliCommandExecutorMock = jest.mocked(CliCommandExecutor);

describe('orgDisplay Unit Tests.', () => {
  const fakeProjectPath = '/this/is/a/fake/path';
  const fakeCommandOuput = {
    fake: true
  };
  const fakeOrgInfo: OrgInfo = {
    username: 'name',
    devHubId: 'devHubId',
    id: 'id',
    createdBy: 'someone',
    createdDate: new Date().toDateString(),
    expirationDate: new Date().toDateString(),
    status: 'active',
    edition: 'Enterprise',
    orgName: 'My org',
    accessToken: '123',
    instanceUrl: 'https://wwww.salesforce.com',
    clientId: 'foo'
  };

  let withArgsMock: jest.Mock;

  describe('getOrgInfo()', () => {
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
          result: fakeOrgInfo
        })
      );
    });

    it('Should return orgInfo on success', async () => {
      const orgDisplay = new OrgDisplay();
      const result = await orgDisplay.getOrgInfo(fakeProjectPath);

      expect(result).toEqual(fakeOrgInfo);

      expect(sfdxCommandBuilderMock).toHaveBeenCalled();
      const mockSfdxCommandBuilder = sfdxCommandBuilderMock.mock.instances[0];
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledTimes(1);
      expect(mockSfdxCommandBuilder.withArg).toHaveBeenCalledWith(
        ORG_DISPLAY_COMMAND
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

    it('Should reject if fails to parse orgInfo.', () => {
      const badJson = '{so:not:value:json}';
      (commandOutputMock.prototype.getCmdResult as any).mockResolvedValue(
        badJson
      );

      const orgDisplay = new OrgDisplay();
      // tslint:disable-next-line:no-floating-promises
      expect(orgDisplay.getOrgInfo(fakeProjectPath)).rejects.toEqual(badJson);
    });
  });
});
