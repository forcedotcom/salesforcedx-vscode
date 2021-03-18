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
import { FauxClassGenerator } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator';
import {
  SObjectCategory,
  SObjectRefreshSource
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/types';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  LocalCommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  notificationService,
  ProgressNotification
} from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

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

export class ForceRefreshSObjectsExecutor extends SfdxCommandletExecutor<{}> {
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
    if (ForceRefreshSObjectsExecutor.isActive) {
      vscode.window.showErrorMessage(
        nls.localize('force_sobjects_no_refresh_if_already_active_error_text')
      );
      return;
    }
    const startTime = process.hrtime();
    ForceRefreshSObjectsExecutor.isActive = true;
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
      this.logMetric(
        commandName,
        startTime,
        {
          category: result.data.category ?? '',
          source: result.data.source ?? '',
          cancelled: String(result.data.cancelled)
        },
        {
          standardObjects: result.data.standardObjects ?? 0,
          customObjects: result.data.customObjects ?? 0
        }
      );
    } catch (result) {
      console.log('Generate error ' + result.error);
      telemetryService.sendException(result.name, result.error);
    }

    ForceRefreshSObjectsExecutor.isActive = false;
    return;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceRefreshSObjects(source?: SObjectRefreshSource) {
  const parameterGatherer = new SObjectRefreshGatherer(source);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceRefreshSObjectsExecutor()
  );
  await commandlet.run();
}

export async function verifyUsernameAndInitSObjectDefinitions(
  projectPath: string
) {
  const hasDefaultUsernameSet =
    (await workspaceContext.getConnection()).getUsername() !== undefined;
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
      telemetryService.sendEventData(
        'sObjectRefreshNotification',
        { type: SObjectRefreshSource.Startup },
        undefined
      );
      forceRefreshSObjects(SObjectRefreshSource.Startup).catch(e => {
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
  if (projectPath && !fs.existsSync(getStandardSObjectsDirectory(projectPath))) {
    telemetryService.sendEventData(
      'sObjectRefreshNotification',
      { type: SObjectRefreshSource.StartupMin },
      undefined
    );
    try {
      await forceRefreshSObjects(SObjectRefreshSource.StartupMin);
    } catch (e) {
      telemetryService.sendException(e.name, e.message);
      throw e;
    }
  }
}
