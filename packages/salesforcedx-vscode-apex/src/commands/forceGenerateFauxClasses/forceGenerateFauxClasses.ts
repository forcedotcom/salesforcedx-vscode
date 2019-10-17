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
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src';
import { SObjectCategory } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import {
  FauxClassGenerator,
  SObjectRefreshSelection,
  SObjectRefreshSource
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator';
import {
  Command,
  LocalCommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';
import {
  ProjectObjects,
  SchemaList,
  SObjectCollector
} from './sobjectCollectors';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  getDefaultUsernameOrAlias,
  getRootWorkspacePath,
  notificationService,
  ProgressNotification,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  taskViewService
} = sfdxCoreExports;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;

export class ForceGenerateFauxClassesExecutor extends SfdxCommandletExecutor<{}> {
  private static isActive = false;
  private readonly source?: SObjectRefreshSource;

  public constructor(source?: SObjectRefreshSource) {
    super();
    this.source = source || SObjectRefreshSource.Manual;
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_sobjects_refresh'))
      .withArg('sobject definitions refresh')
      .withLogName('force_generate_faux_classes_create')
      .build();
  }

  public async execute(
    response: ContinueResponse<{ category: SObjectCategory }>
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
    if (this.source !== SObjectRefreshSource.Manual) {
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
      const collector = this.getCollector(response.data.category);
      const result = await gen.generate(
        getRootWorkspacePath(),
        Array.from(await collector.getObjectNames())
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

  private getCollector(category: SObjectCategory): SObjectCollector {
    switch (category) {
      case SObjectCategory.ALL:
      case SObjectCategory.STANDARD:
      case SObjectCategory.CUSTOM:
        return new SchemaList(category);
      case SObjectCategory.PROJECT:
        return new ProjectObjects();
    }
  }
}

type SObjectSelection = {
  sobjects: string[];
  category: SObjectCategory;
};

class SObjectCategoryGatherer
  implements ParametersGatherer<{ category: SObjectCategory }> {
  public async gather(): Promise<
    ContinueResponse<{ category: SObjectCategory }> | CancelResponse
  > {
    const category = await this.promptCategory();
    if (category) {
      return { type: 'CONTINUE', data: { category } };
    }
    return { type: 'CANCEL' };
  }

  private async promptCategory(): Promise<SObjectCategory | undefined> {
    const options = [
      nls.localize('sobject_refresh_all'),
      nls.localize('sobject_refresh_project'),
      nls.localize('sobject_refresh_custom'),
      nls.localize('sobject_refresh_standard')
    ];
    switch (await vscode.window.showQuickPick(options)) {
      case options[0]:
        return SObjectCategory.ALL;
      case options[1]:
        return SObjectCategory.PROJECT;
      case options[2]:
        return SObjectCategory.CUSTOM;
      case options[3]:
        return SObjectCategory.STANDARD;
    }
  }
}

export async function forceGenerateFauxClassesCreate(
  source?: SObjectRefreshSource
) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new SObjectCategoryGatherer(),
    new ForceGenerateFauxClassesExecutor(source)
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
