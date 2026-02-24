/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getServicesApi } from '@salesforce/effect-ext-utils';
import {
  type SObjectCategory,
  type SObjectRefreshResult,
  type SObjectRefreshSource,
  SOBJECTS_DIR,
  STANDARDOBJECTS_DIR,
  getMinNames,
  getMinObjects,
  sobjectTypeFilter,
  toMinimalSObject
} from '@salesforce/salesforcedx-sobjects-faux-generator';
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  CancelResponse,
  ContinueResponse,
  fileOrFolderExists,
  isSFContainerMode,
  LocalCommandExecution,
  notificationService,
  ParametersGatherer,
  ProgressNotification,
  projectPaths,
  SfCommandlet,
  SfWorkspaceChecker,
  TimingUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { writeSobjectArtifacts } from './sobjectArtifactWriter';
import { SfCommandletExecutor } from './util/sfCommandletExecutor';

type RefreshSelection = {
  category: SObjectCategory;
  source: SObjectRefreshSource;
};

class SObjectRefreshGatherer implements ParametersGatherer<RefreshSelection> {
  private source?: SObjectRefreshSource;

  constructor(source?: SObjectRefreshSource) {
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
        source: this.source ?? 'manual'
      }
    };
  }
}

export class RefreshSObjectsExecutor extends SfCommandletExecutor<{}> {
  public static readonly refreshSObjectsCommandCompletionEventEmitter = new vscode.EventEmitter();
  public static readonly onRefreshSObjectsCommandCompletion =
    RefreshSObjectsExecutor.refreshSObjectsCommandCompletionEventEmitter.event;
  private static isActive = false;

  public build(_data: {}): Command {
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
    const startTime = TimingUtils.getCurrentTime();
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

    const progressLocation =
      response.data.source === 'manual' ? vscode.ProgressLocation.Notification : vscode.ProgressLocation.Window;

    ProgressNotification.show(execution, cancellationTokenSource, progressLocation);

    try {
      let result: SObjectRefreshResult;
      if (response.data.source === 'startupmin') {
        result = await writeSobjectArtifacts({
          emitter: execution.cmdEmitter,
          cancellationToken,
          sobjects: getMinObjects(),
          sobjectNames: getMinNames()
        });
      } else {
        const { sobjects, sobjectNames } = await fetchSObjectData(response.data.category, response.data.source);
        result = await writeSobjectArtifacts({
          emitter: execution.cmdEmitter,
          cancellationToken,
          sobjects,
          sobjectNames
        });
      }

      console.log(`Generate success ${JSON.stringify(result.data)}`);
      this.logMetric(
        execution.command.logName,
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
      const errorMessage = extractErrorMessage(error);
      console.log(`Generate error ${errorMessage}`);
      telemetryService.sendException(
        'generate_faux_classes_create',
        `Error: ${errorMessage}`
      );
      RefreshSObjectsExecutor.isActive = false;
      await vscode.window.showErrorMessage(errorMessage);

      throw error;
    }

    RefreshSObjectsExecutor.isActive = false;
  }
}

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    if ('error' in error && error.error instanceof Error) return error.error.message;
    if ('message' in error && typeof error.message === 'string') return error.message;
  }
  return String(error);
};

const fetchSObjectData = (
  category: SObjectCategory,
  source: Exclude<SObjectRefreshSource, 'startupmin'>
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* getServicesApi;
      const layer = api.services.MetadataDescribeService.Default;
      const allSObjects = yield* api.services.MetadataDescribeService.listSObjects().pipe(Effect.provide(layer));
      const sobjectNames = allSObjects.filter(sobjectTypeFilter(category, source));
      const rawObjects = yield* api.services.MetadataDescribeService
        .describeCustomObjects(sobjectNames.map(s => s.name))
        .pipe(Effect.provide(layer));
      const sobjects = groupByCustom(rawObjects.map(toMinimalSObject));
      return { sobjects, sobjectNames };
    })
  );

const groupByCustom = (objects: ReturnType<typeof toMinimalSObject>[]) => {
  const grouped = Object.groupBy(objects, o => (o.custom ? 'custom' : 'standard'));
  return {
    standard: grouped.standard ?? [],
    custom: grouped.custom ?? []
  };
};

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

    if (!(await fileOrFolderExists(sobjectFolder))) {
      telemetryService.sendEventData('sObjectRefreshNotification', { type: refreshSource }, undefined);
      try {
        await refreshSObjects(refreshSource);
      } catch (e) {
        telemetryService.sendException(
          'initSObjectDefinitionsError',
          `Error: ${extractErrorMessage(e)} with sobjectRefreshStartup = ${isSettingEnabled}`
        );
        throw e;
      }
    }
  }
};

const getSObjectsDirectory = () => path.join(projectPaths.toolsFolder(), SOBJECTS_DIR);

const getStandardSObjectsDirectory = () => path.join(projectPaths.toolsFolder(), SOBJECTS_DIR, STANDARDOBJECTS_DIR);
