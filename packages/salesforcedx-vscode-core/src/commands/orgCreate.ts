/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  CliCommandExecutor,
  Command,
  ContinueResponse,
  isAlphaNumSpaceString,
  isIntegerInRange,
  OrgCreateErrorResult,
  OrgCreateResultParser,
  ParametersGatherer,
  SfCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { OrgType, workspaceContextUtils } from '../context';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';
import {
  CompositeParametersGatherer,
  CompositePreconditionChecker,
  DevUsernameChecker,
  FileSelection,
  FileSelector,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker
} from './util';

export const DEFAULT_ALIAS = 'vscodeScratchOrg';
export const DEFAULT_EXPIRATION_DAYS = '7';

export class OrgCreateExecutor extends SfCommandletExecutor<AliasAndFileSelection> {
  public build(data: AliasAndFileSelection): Command {
    const selectionPath = path.relative(
      workspaceUtils.getRootWorkspacePath(), // this is safe because of workspaceChecker
      data.file
    );
    return new SfCommandBuilder()
      .withDescription(nls.localize('org_create_default_scratch_org_text'))
      .withArg('org:create:scratch')
      .withFlag('--definition-file', `${selectionPath}`)
      .withFlag('--alias', data.alias)
      .withFlag('--duration-days', data.expirationDays)
      .withArg('--set-default')
      .withLogName('org_create_default_scratch_org')
      .withJson()
      .build();
  }

  public execute(response: ContinueResponse<AliasAndFileSelection>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath(),
      env: { SF_JSON_TO_STDOUT: 'true' }
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
          workspaceContextUtils.setWorkspaceOrgTypeWithOrgType(OrgType.SourceTracked);
        } else {
          const errorResponse = createParser.getResult() as OrgCreateErrorResult;
          if (errorResponse) {
            channelService.appendLine(errorResponse.message);
            telemetryService.sendException('org_create', errorResponse.message);
          }
        }
      } catch (err) {
        channelService.appendLine(nls.localize('org_create_result_parsing_error'));
        channelService.appendLine(err);
        telemetryService.sendException(
          'org_create_scratch',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Error while parsing org create response ${err}`
        );
      }
    });

    notificationService.reportCommandExecutionStatus(execution, cancellationToken);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export class AliasGatherer implements ParametersGatherer<Alias> {
  public async gather(): Promise<CancelResponse | ContinueResponse<Alias>> {
    const defaultExpirationdate = DEFAULT_EXPIRATION_DAYS;
    let defaultAlias = DEFAULT_ALIAS;
    if (workspaceUtils.hasRootWorkspace()) {
      const folderName = workspaceUtils
        .getRootWorkspace()
        .name.replace(/\W/g /* Replace all non-alphanumeric characters */, '');
      defaultAlias = isAlphaNumSpaceString(folderName) ? folderName : DEFAULT_ALIAS;
    }
    const aliasInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: defaultAlias,
      validateInput: value => {
        return isAlphaNumSpaceString(value) || value === '' ? null : nls.localize('error_invalid_org_alias');
      }
    } as vscode.InputBoxOptions;
    const alias = await vscode.window.showInputBox(aliasInputOptions);
    // Hitting enter with no alias will use the value of `defaultAlias`
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }
    const expirationDaysInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_scratch_org_expiration_days'),
      placeHolder: defaultExpirationdate,
      validateInput: value => {
        return isIntegerInRange(value, [1, 30]) || value === '' ? null : nls.localize('error_invalid_expiration_days');
      }
    } as vscode.InputBoxOptions;
    const scratchOrgExpirationInDays = await vscode.window.showInputBox(expirationDaysInputOptions);
    if (scratchOrgExpirationInDays === undefined) {
      return { type: 'CANCEL' };
    }
    return {
      type: 'CONTINUE',
      data: {
        alias: alias === '' ? defaultAlias : alias,
        expirationDays: scratchOrgExpirationInDays === '' ? defaultExpirationdate : scratchOrgExpirationInDays
      }
    };
  }
}
export type Alias = {
  alias: string;
  expirationDays: string;
};

export type AliasAndFileSelection = Alias & FileSelection;

const preconditionChecker = new CompositePreconditionChecker(new SfWorkspaceChecker(), new DevUsernameChecker());
const parameterGatherer = new CompositeParametersGatherer(
  new FileSelector(
    nls.localize('parameter_gatherer_enter_scratch_org_def_files'),
    nls.localize('error_no_scratch_def'),
    'config/**/*-scratch-def.json'
  ),
  new AliasGatherer()
);

export const orgCreate = (): void => {
  const commandlet = new SfCommandlet(preconditionChecker, parameterGatherer, new OrgCreateExecutor());
  void commandlet.run();
};
