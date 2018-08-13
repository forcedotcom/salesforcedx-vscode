import { SfdxCommandBuilder } from './commandBuilder';
import { CliCommandExecutor } from './commandExecutor';
import { CommandOutput } from './commandOutput';

interface OrgInfo {
  accessToken: string;
  connectedStatus: string;
  created: number;
  createdOrgInstance: string;
  devHubUsername: string;
  instanceUrl: string;
  isMissing: boolean;
  lastUsed: string;
  loginUrl: string;
  orgId: string;
  status: string;
  username: string;
  alias: string;
}

interface OrgList {
  devHubs: OrgInfo[];
  nonScratchOrgs: OrgInfo[];
  scratchOrgs: OrgInfo[];
}

export class ForceOrgList {
  public async isScratchOrg(username: string): Promise<boolean> {
    const orgList = await this.getOrgList();
    const scratchOrgs = orgList.scratchOrgs; // array of scratchOrgs
    if (scratchOrgs.length > 0) {
      const foundOrgForName = scratchOrgs.some(
        scratchOrg =>
          scratchOrg.alias === username || scratchOrg.username === username
      );
      if (foundOrgForName) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  private async getOrgList(): Promise<OrgList> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:org:list')
        .withArg('--all')
        .withJson()
        .build(),
      {}
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);

    try {
      const orgList = JSON.parse(result).result;
      return Promise.resolve(orgList);
    } catch (e) {
      return Promise.reject(result);
    }
  }
}
