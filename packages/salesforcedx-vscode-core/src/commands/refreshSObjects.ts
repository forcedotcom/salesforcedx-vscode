/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  SObjectCategory,
  SObjectRefreshSource,
  SOBJECTS_DIR,
  SObjectTransformerFactory,
  STANDARDOBJECTS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator';
import {
  CancelResponse,
  Command,
  ContinueResponse,
  isSFContainerMode,
  LocalCommandExecution,
  notificationService,
  ParametersGatherer,
  ProgressNotification,
  projectPaths,
  SfdxCommandBuilder,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { WorkspaceContext } from '../context';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

export type RefreshSelection = {
  category: SObjectCategory;
  source: SObjectRefreshSource;
};

export class SObjectRefreshGatherer
  implements ParametersGatherer<RefreshSelection>
{
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

export class RefreshSObjectsExecutor extends SfdxCommandletExecutor<{}> {
  private static isActive = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('sobjects_refresh'))
      .withArg('sobject definitions refresh')
      .withLogName('force_generate_faux_classes_create')
      .build();
  }

  public async execute(
    response: ContinueResponse<RefreshSelection>
  ): Promise<void> {
    if (RefreshSObjectsExecutor.isActive) {
      await vscode.window.showErrorMessage(
        nls.localize('sobjects_no_refresh_if_already_active_error_text')
      );
      return;
    }
    const startTime = process.hrtime();
    RefreshSObjectsExecutor.isActive = true;
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new LocalCommandExecution(this.build(response.data));

    channelService.streamCommandOutput(execution);

    if (this.showChannelOutput && !isSFContainerMode()) {
      channelService.showChannelOutput();
    }

    if (response.data.source !== SObjectRefreshSource.StartupMin) {
      notificationService.reportCommandExecutionStatus(
        execution,
        channelService,
        cancellationToken
      );
    }

    let progressLocation = vscode.ProgressLocation.Notification;
    if (response.data.source !== SObjectRefreshSource.Manual) {
      progressLocation = vscode.ProgressLocation.Window;
    }
    ProgressNotification.show(
      execution,
      cancellationTokenSource,
      progressLocation
    );

    const commandName = execution.command.logName;
    try {
      let transformer;
      if (response.data.source === SObjectRefreshSource.StartupMin) {
        transformer = await SObjectTransformerFactory.create(
          execution.cmdEmitter,
          cancellationToken,
          SObjectCategory.STANDARD,
          SObjectRefreshSource.StartupMin
        );
      } else {
        transformer = await SObjectTransformerFactory.create(
          execution.cmdEmitter,
          cancellationToken,
          response.data.category,
          response.data.source
        );
      }
      const result = await transformer.transform();

      console.log('Generate success ' + JSON.stringify(result.data));
      this.logMetric(
        commandName,
        startTime,
        {
          category: response.data.category,
          source: response.data.source,
          cancelled: String(result.data.cancelled)
        },
        {
          standardObjects: result.data.standardObjects ?? 0,
          customObjects: result.data.customObjects ?? 0
        }
      );
    } catch (error) {
      console.log('Generate error ' + error.error);
      telemetryService.sendException(error.name, error.error);
      RefreshSObjectsExecutor.isActive = false;

      throw error;
    }

    RefreshSObjectsExecutor.isActive = false;
    return;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export const refreshSObjects = async (source?: SObjectRefreshSource) => {
  const parameterGatherer = new SObjectRefreshGatherer(source);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new RefreshSObjectsExecutor()
  );
  await commandlet.run();
};

export const verifyUsernameAndInitSObjectDefinitions = async (
  projectPath: string
) => {
  const hasDefaultUsernameSet =
    (await WorkspaceContext.getInstance().getConnection()).getUsername() !==
    undefined;
  if (hasDefaultUsernameSet) {
    initSObjectDefinitions(projectPath).catch(e =>
      telemetryService.sendException(e.name, e.message)
    );
  }
};

export const initSObjectDefinitions = async (projectPath: string) => {
  if (projectPath) {
    const sobjectFolder = getSObjectsDirectory();
    if (!fs.existsSync(sobjectFolder)) {
      telemetryService.sendEventData(
        'sObjectRefreshNotification',
        { type: SObjectRefreshSource.Startup },
        undefined
      );
      try {
        await refreshSObjects(SObjectRefreshSource.Startup);
      } catch (e) {
        telemetryService.sendException(e.name, e.message);
        throw e;
      }
    }
  }
};

const getSObjectsDirectory = () => {
  return path.join(projectPaths.toolsFolder(), SOBJECTS_DIR);
};

const getStandardSObjectsDirectory = () => {
  return path.join(
    projectPaths.toolsFolder(),
    SOBJECTS_DIR,
    STANDARDOBJECTS_DIR
  );
};

export const checkSObjectsAndRefresh = async (projectPath: string) => {
  if (projectPath && !fs.existsSync(getStandardSObjectsDirectory())) {
    telemetryService.sendEventData(
      'sObjectRefreshNotification',
      { type: SObjectRefreshSource.StartupMin },
      undefined
    );
    try {
      await refreshSObjects(SObjectRefreshSource.StartupMin);
    } catch (e) {
      telemetryService.sendException(e.name, e.message);
      throw e;
    }
  }
};
