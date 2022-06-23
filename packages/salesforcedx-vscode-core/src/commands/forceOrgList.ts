/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder,

  CliCommandExecutor,
  CommandOutput,

} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';



import { nls } from '../messages';
import {
  EmptyParametersGatherer,
  PromptConfirmGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

// import { workspaceContextInstance } from '../context'
import { OrgListPanel } from '../panels/orgListPanel';

// import { extensionUri, getExtensionUri } from '../index'
import { extensionUri } from '../index'
import { getRootWorkspacePath } from '../util';


export class ForceOrgListExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: { choice?: string }): Command {
    return new SfdxCommandBuilder()
      // .withDescription(nls.localize('force_org_list_clean_text'))
      .withArg('force:org:list')
      .withArg('--all')
      // .withArg('--noprompt')
      // .withLogName('force_org_list_clean')
      .withArg('--json')
      .build();
  }
}

export async function forceOrgList(arg1: any, arg2: any, arg3: any) {
  
  if (extensionUri) {
    OrgListPanel.render(extensionUri);
  }



  /*
  // const parameterGatherer = new PromptConfirmGatherer(
  //   // nls.localize('parameter_gatherer_placeholder_org_list_clean')
  //   nls.localize('parameter_gatherer_placeholder_org_list')
  // );


  // checker: PreconditionChecker,
  // gatherer: ParametersGatherer<T>,
  // executor: CommandletExecutor<T>,
  // postchecker = new EmptyPostChecker()


  const checker = new SfdxWorkspaceChecker();
  const gatherer = new EmptyParametersGatherer(),
  const executor = new ForceOrgListExecutor();

  const commandlet = new SfdxCommandlet(
    checker,
    gatherer,
    executor
  );
  await commandlet.run();
  */


  // debugger;

  const sfdxCommandBuilder = new SfdxCommandBuilder()
    // .withArg('force:data:record:create')
    // .withFlag('--sobjecttype', 'ApexDebuggerBreakpoint')
    // .withFlag(
    //   '--values',
    //   `SessionId='${sessionId}' FileName='${typeref}' Line=${line} IsEnabled='true' Type='Line'`
    // )
    // .withArg('--usetoolingapi')
    // .withJson()
    // .build(),
    // {
    //   cwd: projectPath,
    //   env: this.requestService.getEnvVars()
    // };
    .withArg('force:org:list')
    .withArg('--all')
    .withArg('--json')
    .build();

  const cwd = getRootWorkspacePath();
  const cliCommandExecutor = new CliCommandExecutor(
    sfdxCommandBuilder,
    {
      cwd
    }
  );

  const cliCommandExecution = cliCommandExecutor.execute();

  const commandOutput = new CommandOutput();
  const jsonCommandResult = await commandOutput.getCmdResult(cliCommandExecution);
  try {

    // debugger;

    const commandResult = JSON.parse(jsonCommandResult);
    if (commandResult.status === 0) {

      /*
        TODO: also need to get the data from sfdx force:org:list --all
        Either:
          a) embed a second call here
          b) call CliCommandExecutor with two commands?
          c) don't use CLI and get the lists from a library
      */

      OrgListPanel.setViewOrgListData(commandResult.result);
    } else {
      // TODO: report error
      debugger;
    }

    // const breakpointId = JSON.parse(result).result.id as string;
    // if (this.isApexDebuggerBreakpointId(breakpointId)) {
    //   return Promise.resolve(breakpointId);
    // } else {
    //   return Promise.reject(result);
    // }
  } catch (e) {

    // debugger;

    // TODO: report error
    return Promise.reject(jsonCommandResult);
  }

  // debugger;
}
