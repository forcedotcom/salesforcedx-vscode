/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecution,
  CliCommandExecutor,
  Command,
  ContinueResponse,
  ForceDeployResultParser,
  SfdxCommandBuilder,
  Table,
  TelemetryBuilder,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { PersistentStorageService } from '../conflict';
import { handleDiagnosticErrors } from '../diagnostics';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import {
  CommandParams,
  EmptyParametersGatherer,
  FlagParameter,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export enum DeployType {
  Deploy = 'deploy',
  Push = 'push'
}

export const pushCommand: CommandParams = {
  command: 'force:source:push',
  description: {
    default: 'force_source_push_default_org_text',
    forceoverwrite: 'force_source_push_force_default_org_text'
  },
  logName: { default: 'force_source_push_default_scratch_org' }
};

export class ForceSourcePushExecutor extends SfdxCommandletExecutor<{}> {
  private flag: string | undefined;
  public static errorCollection = vscode.languages.createDiagnosticCollection(
    'deploy-errors'
  );
  public constructor(
    flag?: string,
    public params: CommandParams = pushCommand
  ) {
    super();
    this.flag = flag;
  }

  protected getDeployType() {
    return DeployType.Push;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize(this.params.description.default))
      .withArg(this.params.command)
      .withJson()
      .withLogName(this.params.logName.default);
    if (this.flag === '--forceoverwrite') {
      builder.withArg(this.flag);
      builder.withDescription(
        nls.localize(this.params.description.forceoverwrite)
      );
    }
    return builder.build();
  }

  public execute(response: ContinueResponse<string>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const workspacePath = workspaceUtils.getRootWorkspacePath() || '';
    const execFilePathOrPaths =
      this.getDeployType() === DeployType.Deploy ? response.data : '';
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspacePath,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);
    channelService.streamCommandStartStop(execution);

    let stdOut = '';
    execution.stdoutSubject.subscribe(realData => {
      stdOut += realData.toString();
    });

    execution.processExitSubject.subscribe(async exitCode => {
      await this.exitProcessHandlerPush(
        exitCode,
        stdOut,
        workspacePath,
        execFilePathOrPaths,
        execution,
        startTime,
        cancellationToken,
        cancellationTokenSource
      );
    });
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  protected async exitProcessHandlerPush(
    exitCode: number | undefined,
    stdOut: string,
    workspacePath: string,
    execFilePathOrPaths: string,
    execution: CliCommandExecution,
    startTime: [number, number],
    cancellationToken: vscode.CancellationToken | undefined,
    cancellationTokenSource: vscode.CancellationTokenSource
  ): Promise<void> {
    if (exitCode === 0 && this.getDeployType() === DeployType.Push) {
      const pushResult = this.parseOutput(stdOut);
      this.updateCache(pushResult);
    }

    const telemetry = new TelemetryBuilder();
    let success = false;
    try {
      ForceSourcePushExecutor.errorCollection.clear();
      if (stdOut) {
        const deployParser = new ForceDeployResultParser(stdOut);
        const errors = deployParser.getErrors();
        if (errors && !deployParser.hasConflicts()) {
          channelService.showChannelOutput();
          handleDiagnosticErrors(
            errors,
            workspacePath,
            execFilePathOrPaths,
            ForceSourcePushExecutor.errorCollection
          );
        } else {
          success = true;
        }
        this.outputResult(deployParser);
      }
    } catch (e) {
      ForceSourcePushExecutor.errorCollection.clear();
      if (e.name !== 'DeployParserFail') {
        e.message = 'Error while creating diagnostics for vscode problem view.';
      }
      telemetryService.sendException(e.name, e.message);
      console.error(e.message);
    }
    telemetry.addProperty('success', String(success));
    this.logMetric(
      execution.command.logName,
      startTime,
      telemetry.build().properties
    );
    this.onDidFinishExecutionEventEmitter.fire(startTime);
  }

  /**
   * Pass the pushed source to PersistentStorageService for
   * updating of timestamps, so that conflict detection will behave as expected
   * @param pushResult that comes from stdOut after cli push operation
   */
  protected updateCache(pushResult: any): void {
    const pushedSource = pushResult.result.pushedSource;

    const instance = PersistentStorageService.getInstance();
    instance.setPropertiesForFilesPushPull(pushedSource);
  }

  public outputResult(parser: ForceDeployResultParser) {
    const table = new Table();
    const titleType = this.getDeployType();

    const successes = parser.getSuccesses();
    const errors = parser.getErrors();
    const deployedSource = successes
      ? successes.result.deployedSource
      : undefined;
    if (deployedSource || parser.hasConflicts()) {
      const rows = deployedSource || (errors && errors.result);
      const title = !parser.hasConflicts()
        ? nls.localize(`table_title_${titleType}ed_source`)
        : undefined;
      const outputTable = this.getOutputTable(table, rows, title);
      if (parser.hasConflicts()) {
        channelService.appendLine(nls.localize('push_conflicts_error') + '\n');
      }
      channelService.appendLine(outputTable);
      if (deployedSource && deployedSource.length === 0) {
        const noResults = nls.localize('table_no_results_found') + '\n';
        channelService.appendLine(noResults);
      }
    }

    if (errors && !parser.hasConflicts()) {
      const { name, message, result } = errors;
      if (result) {
        const outputTable = this.getErrorTable(table, result, titleType);
        channelService.appendLine(outputTable);
      } else if (name && message) {
        channelService.appendLine(`${name}: ${message}\n`);
      }
    }
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceSourcePush(this: FlagParameter<string>) {
  const { flag } = this || {};
  const executor = new ForceSourcePushExecutor(flag, pushCommand);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
