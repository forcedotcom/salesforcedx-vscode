/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  OrgCreateErrorResult,
  OrgCreateResultParser,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { OrgType, setWorkspaceOrgTypeWithOrgType } from '../context';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import {
  getRootWorkspace,
  getRootWorkspacePath,
  hasRootWorkspace
} from '../util';
import {
  CompositeParametersGatherer,
  CompositePreconditionChecker,
  DevUsernameChecker,
  FileSelection,
  FileSelector,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export const DEFAULT_ALIAS = 'vscodeScratchOrg';
export const DEFAULT_EXPIRATION_DAYS = '7';

export class ForceOrgCreateExecutor extends SfdxCommandletExecutor<
  AliasAndFileSelection
> {
  public build(data: AliasAndFileSelection): Command {
    const selectionPath = path.relative(
      getRootWorkspacePath(), // this is safe because of workspaceChecker
      data.file
    );
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_org_create_default_scratch_org_text')
      )
      .withArg('force:org:create')
      .withFlag('-f', `${selectionPath}`)
      .withFlag('--setalias', data.alias)
      .withFlag('--durationdays', data.expirationDays)
      .withArg('--setdefaultusername')
      .withLogName('force_org_create_default_scratch_org')
      .withJson()
      .build();
  }

  public execute(response: ContinueResponse<AliasAndFileSelection>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath(),
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    channelService.streamCommandStartStop(execution);

    let stdOut = '';
    execution.stdoutSubject.subscribe(realData => {
      stdOut += realData.toString();
    });

    execution.processExitSubject.subscribe(async exitCode => {
      this.logMetric(execution.command.logName, startTime);
      try {
        const createParser = new OrgCreateResultParser(stdOut);

        if (createParser.createIsSuccessful()) {
          // NOTE: there is a beta in which this command also allows users to create sandboxes
          // once it's GA this will have to be updated
          setWorkspaceOrgTypeWithOrgType(OrgType.SourceTracked);
        } else {
          const errorResponse = createParser.getResult() as OrgCreateErrorResult;
          channelService.appendLine(errorResponse.message);
          telemetryService.sendException(
            'force_org_create',
            errorResponse.message
          );
        }
      } catch (err) {
        channelService.appendLine(
          nls.localize('force_org_create_result_parsing_error')
        );
        channelService.appendLine(err);
        telemetryService.sendException(
          'force_org_create',
          `Error while parsing org create response ${err}`
        );
      }
    });

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export class AliasGatherer implements ParametersGatherer<Alias> {
  public async gather(): Promise<CancelResponse | ContinueResponse<Alias>> {
    const defaultExpirationdate = DEFAULT_EXPIRATION_DAYS;
    let defaultAlias = DEFAULT_ALIAS;
    if (hasRootWorkspace()) {
      defaultAlias = getRootWorkspace().name.replace(
        /\W/g /* Replace all non-alphanumeric characters */,
        ''
      );
    }
    const aliasInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: defaultAlias,
      validateInput: value => {
        if (/\W/.test(value)) {
          return nls.localize('error_invalid_org_alias');
        }
        return null;
      }
    } as vscode.InputBoxOptions;
    const alias = await vscode.window.showInputBox(aliasInputOptions);
    // Hitting enter with no alias will use the value of `defaultAlias`
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }
    const expirationDays = {
      prompt: nls.localize(
        'parameter_gatherer_enter_scratch_org_expiration_days'
      ),
      value: defaultExpirationdate,
      validateInput: value => {
        const days = Number.parseInt(value);
        if (!Number.isSafeInteger(days) || days < 1 || days > 30) {
          return nls.localize('error_invalid_expiration_days');
        }
        return null;
      }
    } as vscode.InputBoxOptions;
    const scratchOrgExpirationInDays = await vscode.window.showInputBox(
      expirationDays
    );
    if (scratchOrgExpirationInDays === undefined) {
      return { type: 'CANCEL' };
    }
    return {
      type: 'CONTINUE',
      data: {
        alias: alias === '' ? defaultAlias : alias,
        expirationDays: scratchOrgExpirationInDays
      }
    };
  }
}
export interface Alias {
  alias: string;
  expirationDays: string;
}

export type AliasAndFileSelection = Alias & FileSelection;

const preconditionChecker = new CompositePreconditionChecker(
  new SfdxWorkspaceChecker(),
  new DevUsernameChecker()
);
const parameterGatherer = new CompositeParametersGatherer(
  new FileSelector('config/**/*-scratch-def.json'),
  new AliasGatherer()
);

export async function forceOrgCreate() {
  const commandlet = new SfdxCommandlet(
    preconditionChecker,
    parameterGatherer,
    new ForceOrgCreateExecutor()
  );
  await commandlet.run();
}
