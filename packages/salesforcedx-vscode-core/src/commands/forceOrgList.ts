import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { nls } from '../messages';
import {
  PromptConfirmGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export class ForceOrgListExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: { choice?: string }): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_org_list_clean_text'))
      .withArg('force:org:list')
      .withArg('--clean')
      .withArg('--noprompt')
      .withLogName('force_org_list_clean')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceOrgList() {
  const parameterGatherer = new PromptConfirmGatherer();
  const executor = new ForceOrgListExecutor();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
