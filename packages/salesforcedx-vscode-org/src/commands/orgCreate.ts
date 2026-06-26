/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Global } from '@salesforce/core/global';
import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  notificationService,
  CompositeParametersGatherer,
  CancelResponse,
  CliCommandExecutor,
  ContinueResponse,
  ParametersGatherer,
  ProgressNotification,
  SfCommandlet,
  SfCommandletExecutor,
  workspaceUtils,
  errorToString
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { channelService } from '../channels';
import { nls } from '../messages';
import { FileSelector, FileSelection } from '../parameterGatherers/fileSelector';
import { OrgCreateResultParser, OrgCreateErrorResult } from '../parsers/orgCreateResultParser';
import { checkDevHubConfigured } from '../preconditionCheckers/devUsernameChecker';
import { telemetryService } from '../telemetry';
import { updateConfigAndStateAggregators } from '../util/orgUtil';

const isAlphaNumSpaceString = (value: string | undefined): boolean =>
  value !== undefined && /^\w+( *\w*)*$/.test(value);

const isInteger = (value: string | undefined): boolean =>
  value !== undefined && !/\D/.test(value) && Number.isSafeInteger(Number.parseInt(value, 10));

const isIntegerInRange = (value: string | undefined, range: [number, number]): boolean =>
  value !== undefined &&
  isInteger(value) &&
  Number.parseInt(value, 10) >= range[0] &&
  Number.parseInt(value, 10) <= range[1];

const DEFAULT_ALIAS = 'vscodeScratchOrg';
const DEFAULT_EXPIRATION_DAYS = '7';

// Persist the raw scratch-create CLI output to ~/.sf/vscode-spans on failure. That dir is the only
// sink e2e CI uploads as an artifact (orgE2E.yml copies it to test-results), and the channel it also
// streams to is a virtualized Monaco editor whose scrollback no artifact captures. Captures stdout,
// stderr, and exit code since a failing create may report its error on any of them. Best-effort: a
// write failure must never mask the real CLI error.
const dumpCreateFailureBody = async (parts: {
  exitCode: number | undefined;
  stdOut: string;
  stdErr: string;
}): Promise<void> => {
  try {
    const dir = URI.file(path.join(Global.SF_DIR, 'vscode-spans'));
    await vscode.workspace.fs.createDirectory(dir);
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const file = URI.file(path.join(dir.fsPath, `org-create-failure-${timestamp}.txt`));
    const body = `exitCode: ${parts.exitCode}\n\n=== stdout ===\n${parts.stdOut}\n\n=== stderr ===\n${parts.stdErr}\n`;
    await vscode.workspace.fs.writeFile(file, new TextEncoder().encode(body));
  } catch {
    // best-effort diagnostics only
  }
};

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
    const startTime = globalThis.performance.now();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspaceUtils.getRootWorkspacePath(),
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    channelService.streamCommandOutput(execution);

    let stdOut = '';
    execution.stdoutSubject.subscribe(realData => {
      stdOut += realData.toString();
    });
    // accumulate stderr too: a failing scratch create may write its error there (or nothing to
    // stdout at all), so the failure dump needs both streams to capture the real CLI error.
    let stdErr = '';
    execution.stderrSubject.subscribe(realData => {
      stdErr += realData.toString();
    });

    // 3min hard timeout: if the CLI never exits, cancel so the 1s watcher SIGKILLs the child.
    const timer = setTimeout(() => cancellationTokenSource.cancel(), 180_000);

    // old rxjs doesn't like async functions in subscribe, but we use them and they seem to work.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    execution.processExitSubject.subscribe(async (exitCode: number | undefined) => {
      clearTimeout(timer);
      this.logMetric(execution.command.logName, startTime);
      try {
        const createParser = new OrgCreateResultParser(stdOut);

        if (createParser.createIsSuccessful()) {
          await updateConfigAndStateAggregators();
        } else {
          // raw CLI --json body already streamed live to the channel via streamCommandOutput;
          // also persist it to the CI-collected spans dir since the channel scrollback isn't artifacted
          await dumpCreateFailureBody({ exitCode, stdOut, stdErr });
          // remove when we drop CLI invocations
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const errorResponse = createParser.getResult() as OrgCreateErrorResult;
          if (errorResponse) {
            channelService.appendLine(errorResponse.message);
            telemetryService.sendException('org_create', errorResponse.message);
          }
        }
      } catch (err) {
        // raw CLI --json body already streamed live to the channel via streamCommandOutput;
        // also persist it to the CI-collected spans dir since the channel scrollback isn't artifacted
        await dumpCreateFailureBody({ exitCode, stdOut, stdErr });
        channelService.appendLine(nls.localize('org_create_result_parsing_error'));
        const stringError = errorToString(err);
        channelService.appendLine(errorToString(stringError));
        telemetryService.sendException('org_create_scratch', `Error while parsing org create response ${stringError}`);
      }
    });

    notificationService.reportCommandExecutionStatus(execution, channelService, cancellationToken);
    ProgressNotification.show(execution, cancellationTokenSource);
  }
}

class AliasGatherer implements ParametersGatherer<Alias> {
  public async gather(): Promise<CancelResponse | ContinueResponse<Alias>> {
    const defaultExpirationdate = DEFAULT_EXPIRATION_DAYS;
    let defaultAlias = DEFAULT_ALIAS;
    if (workspaceUtils.hasRootWorkspace()) {
      const folderName = workspaceUtils
        .getRootWorkspace()
        .name.replaceAll(/\W/g /* Replace all non-alphanumeric characters */, '');
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

export const orgCreate = async (): Promise<void> => {
  if (!(await checkDevHubConfigured())) {
    return;
  }
  const parameterGatherer = new CompositeParametersGatherer(
    new FileSelector(
      nls.localize('parameter_gatherer_enter_scratch_org_def_files'),
      nls.localize('error_no_scratch_def'),
      'config/**/*-scratch-def.json'
    ),
    new AliasGatherer()
  );
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, parameterGatherer, new OrgCreateExecutor());
  void commandlet.run();
};
