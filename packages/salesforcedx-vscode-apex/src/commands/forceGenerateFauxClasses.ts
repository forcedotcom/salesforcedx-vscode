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
  CliCommandExecution,
  CliCommandExecutor,
  Command,
  CommandOutput,
  LocalCommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { extractJsonObject } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { SObjectRefreshGatherer } from './utils';

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
  SfdxPackageDirectories,
  SfdxWorkspaceChecker,
  taskViewService
} = sfdxCoreExports;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;

export class ForceListSObjectSchemaExecutor {
  public build(type: string): Command {
    return new SfdxCommandBuilder()
      .withArg('force:schema:sobject:list')
      .withFlag('--sobjecttypecategory', type)
      .withJson()
      .build();
  }

  public async execute(type: string): Promise<string[]> {
    // error handle this better
    const execution = new CliCommandExecutor(this.build(type), {
      cwd: getRootWorkspacePath()
    }).execute();
    try {
      const result = await new CommandOutput().getCmdResult(execution);
      return extractJsonObject(result).result as string[];
    } catch (e) {
      return Promise.reject(e);
    }
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
    response: ContinueResponse<SObjectRefreshSelection>
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
    if (response.data.source !== SObjectRefreshSource.Manual) {
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
      let sobjects: string[] = [];
      switch (response.data.category) {
        case SObjectCategory.ALL:
        case SObjectCategory.CUSTOM:
        case SObjectCategory.STANDARD:
          const listExecutor = new ForceListSObjectSchemaExecutor();
          sobjects = await listExecutor.execute(response.data.category);
          break;
        case SObjectCategory.PROJECT:
          sobjects = Array.from(await this.getLocalObjects());
      }
      const result = await gen.generate(
        getRootWorkspacePath(),
        response.data,
        sobjects
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

  private async getLocalObjects(): Promise<Set<string>> {
    const packageDirectories = await SfdxPackageDirectories.getPackageDirectoryPaths();
    const foundFiles = await vscode.workspace.findFiles(
      `{${packageDirectories.join(',')}}/**/objects/*/*.object-meta.xml`
    );
    const objectNames = foundFiles.map(
      file => path.basename(file.fsPath).split('.')[0]
    );
    return new Set<string>(objectNames);
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
