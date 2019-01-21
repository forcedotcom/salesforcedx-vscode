import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export class ForceConfigSetExecutor extends SfdxCommandletExecutor<{}> {
  private arg: string;

  public constructor(arg: string) {
    super();
    this.arg = arg;
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription('SFDX: Set a Default Org')
      .withArg('force:config:set')
      .withArg('defaultusername=' + this.arg)
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceConfigSet(arg: string) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceConfigSetExecutor(arg)
  );
  await commandlet.run();
}
