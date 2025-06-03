/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  type SObjectCategory,
  type SObjectRefreshSource,
  SOBJECTS_DIR,
  SObjectTransformerFactory,
  STANDARDOBJECTS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator';
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  CancelResponse,
  ContinueResponse,
  isSFContainerMode,
  LocalCommandExecution,
  notificationService,
  ParametersGatherer,
  ProgressNotification,
  projectPaths,
  SfCommandlet,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { SalesforceProjectConfig } from '../salesforceProject';
import { telemetryService } from '../telemetry';
import { SfCommandletExecutor } from './util/sfCommandletExecutor';

type RefreshSelection = {
  category: SObjectCategory;
  source: SObjectRefreshSource;
};

class SObjectRefreshGatherer implements ParametersGatherer<RefreshSelection> {
  private source?: SObjectRefreshSource;

  public constructor(source?: SObjectRefreshSource) {
    this.source = source;
  }

  public async gather(): Promise<ContinueResponse<RefreshSelection> | CancelResponse> {
    let category: SObjectCategory = 'ALL';
    if (!this.source || this.source === 'manual') {
      const options = [
        nls.localize('sobject_refresh_all'),
        nls.localize('sobject_refresh_custom'),
        nls.localize('sobject_refresh_standard')
      ];
      const choice = await vscode.window.showQuickPick(options);
      switch (choice) {
        case options[0]:
          category = 'ALL';
          break;
        case options[1]:
          category = 'CUSTOM';
          break;
        case options[2]:
          category = 'STANDARD';
          break;
        default:
          return { type: 'CANCEL' };
      }
    }
    return {
      type: 'CONTINUE',
      data: {
        category,
        source: this.source || 'manual'
      }
    };
  }
}

export class RefreshSObjectsExecutor extends SfCommandletExecutor<{}> {
  public static readonly refreshSObjectsCommandCompletionEventEmitter = new vscode.EventEmitter();
  public static readonly onRefreshSObjectsCommandCompletion =
    RefreshSObjectsExecutor.refreshSObjectsCommandCompletionEventEmitter.event;
  private static isActive = false;

  public build(data: {}): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('sobjects_refresh'))
      .withArg('sobject definitions refresh')
      .withLogName('generate_faux_classes_create')
      .build();
  }

  public async execute(response: ContinueResponse<RefreshSelection>): Promise<void> {
    if (RefreshSObjectsExecutor.isActive) {
      await vscode.window.showErrorMessage(nls.localize('sobjects_no_refresh_if_already_active_error_text'));
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

    if (response.data.source !== 'startupmin') {
      notificationService.reportCommandExecutionStatus(execution, channelService, cancellationToken);
    }

    let progressLocation = vscode.ProgressLocation.Notification;
    if (response.data.source !== 'manual') {
      progressLocation = vscode.ProgressLocation.Window;
    }
    ProgressNotification.show(execution, cancellationTokenSource, progressLocation);

    const commandName = execution.command.logName;
    try {
      const transformer = await SObjectTransformerFactory.create({
        emitter: execution.cmdEmitter,
        cancellationToken,
        ...(response.data.source === 'startupmin'
          ? {
              category: 'STANDARD',
              source: 'startupmin'
            }
          : {
              category: response.data.category,
              source: response.data.source
            }),
        // @ts-expect-error - TODO: remove when core-bundle is no longer used
        sfProject: await SalesforceProjectConfig.getInstance()
      });

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
      RefreshSObjectsExecutor.refreshSObjectsCommandCompletionEventEmitter.fire({
        exitCode: LocalCommandExecution.SUCCESS_CODE
      });
    } catch (error) {
      console.log('Generate error ' + error.error);
      telemetryService.sendException(
        'generate_faux_classes_create',
        `Error: name = ${error.name} message = ${error.error}`
      );
      RefreshSObjectsExecutor.isActive = false;

      throw error;
    }

    RefreshSObjectsExecutor.isActive = false;
    return;
  }
}

const workspaceChecker = new SfWorkspaceChecker();

export const refreshSObjects = async (source?: SObjectRefreshSource) => {
  const parameterGatherer = new SObjectRefreshGatherer(source);
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, new RefreshSObjectsExecutor());
  await commandlet.run();
};

export const initSObjectDefinitions = async (projectPath: string, isSettingEnabled: boolean) => {
  if (projectPath) {
    const sobjectFolder = isSettingEnabled ? getSObjectsDirectory() : getStandardSObjectsDirectory();
    const refreshSource = isSettingEnabled ? 'startup' : 'startupmin';

    if (!fs.existsSync(sobjectFolder)) {
      telemetryService.sendEventData('sObjectRefreshNotification', { type: refreshSource }, undefined);
      try {
        await refreshSObjects(refreshSource);
      } catch (e) {
        telemetryService.sendException('initSObjectDefinitions', e.message);
        throw e;
      }
    }
  }
};

const getSObjectsDirectory = () => path.join(projectPaths.toolsFolder(), SOBJECTS_DIR);

const getStandardSObjectsDirectory = () => path.join(projectPaths.toolsFolder(), SOBJECTS_DIR, STANDARDOBJECTS_DIR);
