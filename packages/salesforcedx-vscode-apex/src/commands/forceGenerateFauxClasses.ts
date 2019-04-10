/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  SFDX_DIR,
  SOBJECTS_DIR,
  TOOLS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/constants';
import { SObjectCategory } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import {
  FauxClassGenerator,
  SObjectRefreshSource
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator';
import {
  Command,
  LocalCommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  getDefaultUsernameOrAlias,
  notificationService,
  ProgressNotification,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  taskViewService
} = sfdxCoreExports;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;

export class SObjectRefreshGatherer
  implements ParametersGatherer<SObjectRefreshSource> {
  private source: SObjectRefreshSource | undefined;
  public constructor(source?: SObjectRefreshSource) {
    this.source = source;
  }
  public async gather(): Promise<ContinueResponse<SObjectRefreshSource>> {
    return {
      type: 'CONTINUE',
      data: this.source || SObjectRefreshSource.Manual
    };
  }
}

export class ForceGenerateFauxClassesExecutor extends SfdxCommandletExecutor<{}> {
  private static isActive = false;
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_sobjects_refresh'))
      .withArg('sobject definitions refresh')
      .withLogName('force_generate_faux_classes_create')
      .build();
  }

  public async execute(
    response: ContinueResponse<SObjectRefreshSource>
  ): Promise<void> {
    if (ForceGenerateFauxClassesExecutor.isActive) {
      vscode.window.showErrorMessage(
        nls.localize('force_sobjects_no_refresh_if_already_active_error_text')
      );
      return;
    }
    const startTime = process.hrtime();
    ForceGenerateFauxClassesExecutor.isActive = true;
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new LocalCommandExecution(this.build(response.data));

    channelService.streamCommandOutput(execution);

    if (this.showChannelOutput) {
      channelService.showChannelOutput();
    }

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );

    let progressLocation = vscode.ProgressLocation.Notification;
    const refreshSource = response.data;
    if (refreshSource !== SObjectRefreshSource.Manual) {
      progressLocation = vscode.ProgressLocation.Window;
    }
    ProgressNotification.show(
      execution,
      cancellationTokenSource,
      progressLocation
    );

    taskViewService.addCommandExecution(execution, cancellationTokenSource);

    const gen: FauxClassGenerator = new FauxClassGenerator(
      execution.cmdEmitter,
      cancellationToken
    );

    const commandName = execution.command.logName;
    try {
      const result = await gen.generate(
        vscode.workspace.workspaceFolders![0].uri.fsPath,
        SObjectCategory.ALL,
        refreshSource
      );
      console.log('Generate success ' + result.data);
      this.logMetric(commandName, startTime, result.data);
    } catch (result) {
      console.log('Generate error ' + result.error);
      const commandData = {
        commandName,
        executionTime: telemetryService.getEndHRTime(startTime)
      };
      telemetryService.sendErrorEvent(
        result.error,
        Object.assign(result.data, commandData)
      );
    }

    ForceGenerateFauxClassesExecutor.isActive = false;
    return;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceGenerateFauxClassesCreate(
  source?: SObjectRefreshSource
) {
  const parameterGatherer = new SObjectRefreshGatherer(source);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceGenerateFauxClassesExecutor()
  );
  await commandlet.run();
}

export async function initSObjectDefinitions(projectPath: string) {
  const hasDefaultUsernameSet =
    (await getDefaultUsernameOrAlias()) !== undefined;
  if (projectPath && hasDefaultUsernameSet) {
    const sobjectFolder = path.join(
      projectPath,
      SFDX_DIR,
      TOOLS_DIR,
      SOBJECTS_DIR
    );
    if (!fs.existsSync(sobjectFolder)) {
      forceGenerateFauxClassesCreate(SObjectRefreshSource.Startup).catch(e => {
        throw e;
      });
    }
  }
}
