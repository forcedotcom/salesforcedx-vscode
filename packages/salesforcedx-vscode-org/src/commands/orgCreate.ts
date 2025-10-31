/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  notificationService,
  CompositePreconditionChecker,
  CompositeParametersGatherer,
  CancelResponse,
  CliCommandExecutor,
  ConfigUtil,
  ContinueResponse,
  DevUsernameChecker,
  FileSelection,
  FileSelector,
  isAlphaNumSpaceString,
  isIntegerInRange,
  OrgCreateErrorResult,
  OrgCreateResultParser,
  ParametersGatherer,
  ProgressNotification,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker,
  TimingUtils,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

// Get core API services at runtime
const getCoreApi = (): SalesforceVSCodeCoreApi | undefined => {
  const coreExtension = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>('salesforce.salesforcedx-vscode-core');
  return coreExtension?.exports;
};

const getTaskViewService = () => getCoreApi()?.taskViewService;

const DEFAULT_ALIAS = 'vscodeScratchOrg';
const DEFAULT_EXPIRATION_DAYS = '7';

class OrgCreateExecutor extends SfCommandletExecutor<AliasAndFileSelection> {
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
    const startTime = TimingUtils.getCurrentTime();
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

    // old rxjs doesn't like async functions in subscribe, but we use them and they seem to work.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    execution.processExitSubject.subscribe(async () => {
      this.logMetric(execution.command.logName, startTime);
      try {
        const createParser = new OrgCreateResultParser(stdOut);

        if (createParser.createIsSuccessful()) {
          // Explicitly ensure the org change event is triggered
          // Use the alias that was provided when creating the org
          if (response.data.alias) {
            await ConfigUtil.setTargetOrgOrAlias(response.data.alias);
          }

          // Set workspace org type to source-tracked for newly created scratch orgs
          // Scratch orgs are always source-tracked, so set the context to true
          await vscode.commands.executeCommand('setContext', 'sf:target_org_has_change_tracking', true);
        } else {
          // remove when we drop CLI invocations
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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

    notificationService.reportCommandExecutionStatus(execution, channelService, cancellationToken);
    ProgressNotification.show(execution, cancellationTokenSource);
    getTaskViewService()?.addCommandExecution(execution, cancellationTokenSource);
  }
}

class AliasGatherer implements ParametersGatherer<Alias> {
  public async gather(): Promise<CancelResponse | ContinueResponse<Alias>> {
    const defaultExpirationdate = DEFAULT_EXPIRATION_DAYS;
    let defaultAlias = DEFAULT_ALIAS;
    if (workspaceUtils.hasRootWorkspace()) {
      const folderName = workspaceUtils
        .getRootWorkspace()
        .name.replace(/\W/g /* Replace all non-alphanumeric characters */, '');
      defaultAlias = isAlphaNumSpaceString(folderName) ? folderName : DEFAULT_ALIAS;
    }
    const aliasInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: defaultAlias,
      validateInput: value =>
        isAlphaNumSpaceString(value) || value === '' ? null : nls.localize('error_invalid_org_alias')
    };
    const alias = await vscode.window.showInputBox(aliasInputOptions);
    // Hitting enter with no alias will use the value of `defaultAlias`
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }
    const expirationDaysInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_scratch_org_expiration_days'),
      placeHolder: defaultExpirationdate,
      validateInput: value =>
        isIntegerInRange(value, [1, 30]) || value === '' ? null : nls.localize('error_invalid_expiration_days')
    };
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
type Alias = {
  alias: string;
  expirationDays: string;
};

type AliasAndFileSelection = Alias & FileSelection;

export const orgCreate = (): void => {
  const preconditionChecker = new CompositePreconditionChecker(new SfWorkspaceChecker(), new DevUsernameChecker());
  const parameterGatherer = new CompositeParametersGatherer(
    new FileSelector(
      nls.localize('parameter_gatherer_enter_scratch_org_def_files'),
      nls.localize('error_no_scratch_def'),
      'config/**/*-scratch-def.json'
    ),
    new AliasGatherer()
  );
  const commandlet = new SfCommandlet(preconditionChecker, parameterGatherer, new OrgCreateExecutor());
  void commandlet.run();
};
