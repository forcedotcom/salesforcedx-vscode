/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  SFDX_DIR,
  SOBJECTS_DIR,
  STANDARDOBJECTS_DIR,
  TOOLS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src';
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
  CancelResponse,
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

export type RefreshSelection = {
  category: SObjectCategory;
  source: SObjectRefreshSource;
};

export class SObjectRefreshGatherer
  implements ParametersGatherer<RefreshSelection> {
  private source?: SObjectRefreshSource;

  public constructor(source?: SObjectRefreshSource) {
    this.source = source;
  }

  public async gather(): Promise<
    ContinueResponse<RefreshSelection> | CancelResponse
  > {
    let category = SObjectCategory.ALL;
    if (!this.source || this.source === SObjectRefreshSource.Manual) {
      const options = [
        nls.localize('sobject_refresh_all'),
        nls.localize('sobject_refresh_custom'),
        nls.localize('sobject_refresh_standard')
      ];
      const choice = await vscode.window.showQuickPick(options);
      switch (choice) {
        case options[0]:
          category = SObjectCategory.ALL;
          break;
        case options[1]:
          category = SObjectCategory.CUSTOM;
          break;
        case options[2]:
          category = SObjectCategory.STANDARD;
          break;
        default:
          return { type: 'CANCEL' };
      }
    }
    return {
      type: 'CONTINUE',
      data: {
        category,
        source: this.source || SObjectRefreshSource.Manual
      }
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
    response: ContinueResponse<RefreshSelection>
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
      let result;
      if (response.data.source === SObjectRefreshSource.StartupMin) {
        result = await gen.generateMin(
          vscode.workspace.workspaceFolders![0].uri.fsPath,
          response.data.source
        );
      } else {
        result = await gen.generate(
          vscode.workspace.workspaceFolders![0].uri.fsPath,
          response.data.category,
          response.data.source
        );
      }

      console.log('Generate success ' + result.data);
      this.logMetric(commandName, startTime, result.data);
    } catch (result) {
      console.log('Generate error ' + result.error);
      await telemetryService.sendCommandEvent(
        'force_generate_faux_classes_create',
        startTime,
        result.error
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

export async function verifyUsernameAndInitSObjectDefinitions(
  projectPath: string
) {
  const hasDefaultUsernameSet =
    (await getDefaultUsernameOrAlias()) !== undefined;
  if (hasDefaultUsernameSet) {
    initSObjectDefinitions(projectPath).catch(e =>
      telemetryService.sendException(e.name, e.message)
    );
  }
}

export async function initSObjectDefinitions(projectPath: string) {
  if (projectPath) {
    const sobjectFolder = getSObjectsDirectory(projectPath);
    if (!fs.existsSync(sobjectFolder)) {
      forceGenerateFauxClassesCreate(SObjectRefreshSource.Startup).catch(e => {
        throw e;
      });
    }
  }
}

function getSObjectsDirectory(projectPath: string) {
  return path.join(projectPath, SFDX_DIR, TOOLS_DIR, SOBJECTS_DIR);
}

function getStandardSObjectsDirectory(projectPath: string) {
  return path.join(
    projectPath,
    SFDX_DIR,
    TOOLS_DIR,
    SOBJECTS_DIR,
    STANDARDOBJECTS_DIR
  );
}

export async function checkSObjectsAndRefresh(projectPath: string) {
  const hasDefaultUsernameSet = await getDefaultUsernameOrAlias();
  if (projectPath && hasDefaultUsernameSet) {
    if (!fs.existsSync(getStandardSObjectsDirectory(projectPath))) {
      await telemetryService.sendEventData(
        'sObjectRefreshNotification',
        { type: 'No SObjects' },
        undefined
      );
      const message = nls.localize('sobjects_refresh_needed');
      const buttonTxt = nls.localize('sobjects_refresh_now');
      const shouldRefreshNow = await notificationService.showInformationMessage(
        message,
        buttonTxt
      );
      if (shouldRefreshNow && shouldRefreshNow === buttonTxt) {
        await telemetryService.sendEventData(
          'sObjectRefreshNotification',
          { type: 'Requested Refresh' },
          undefined
        );
        try {
          await forceGenerateFauxClassesCreate(SObjectRefreshSource.StartupMin);
        } catch (e) {
          await telemetryService.sendException(e.name, e.message);
          throw e;
        }
      } else {
        await telemetryService.sendEventData(
          'sObjectRefreshNotification',
          { type: 'Refresh Request Cancelled' },
          undefined
        );
      }
    } else {
      await telemetryService.sendEventData(
        'sObjectRefreshNotification',
        { type: 'SObjects exist' },
        undefined
      );
    }
  }
}
