/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancelResponse,
  ContinueResponse,
  LocalComponent,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode';
import { existsSync } from 'fs';
import { basename, join, normalize } from 'path';
import { channelService } from '../../channels';
import {
  conflictView,
  DirectoryDiffResults,
  MetadataCacheService
} from '../../conflict';
import { TimestampConflictDetector } from '../../conflict/timestampConflictDetector';
import { WorkspaceContext } from '../../context';
import { getWorkspaceOrgType, OrgType } from '../../context/workspaceOrgType';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { DeployQueue, sfdxCoreSettings } from '../../settings';
import { telemetryService } from '../../telemetry';
import { MetadataDictionary, workspaceUtils } from '../../util';
import { ConflictDetectionMessages } from './conflictDetectionMessages';
import { PathStrategyFactory } from './sourcePathStrategies';

type OneOrMany = LocalComponent | LocalComponent[];
type ContinueOrCancel = ContinueResponse<OneOrMany> | CancelResponse;

export class CompositePostconditionChecker<T>
  implements PostconditionChecker<T> {
  private readonly postcheckers: Array<PostconditionChecker<any>>;
  public constructor(...postcheckers: Array<PostconditionChecker<any>>) {
    this.postcheckers = postcheckers;
  }
  public async check(
    inputs: CancelResponse | ContinueResponse<T>
  ): Promise<CancelResponse | ContinueResponse<T>> {
    if (inputs.type === 'CONTINUE') {
      const aggregatedData: any = {};
      for (const postchecker of this.postcheckers) {
        inputs = await postchecker.check(inputs);
        if (inputs.type !== 'CONTINUE') {
          return {
            type: 'CANCEL'
          };
        }
      }
    }
    return inputs;
  }
}

/* tslint:disable-next-line:prefer-for-of */
export class OverwriteComponentPrompt
  implements PostconditionChecker<OneOrMany> {
  public async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (inputs.type === 'CONTINUE') {
      const { data } = inputs;
      // normalize data into a list when processing
      const componentsToCheck = data instanceof Array ? data : [data];
      const foundComponents = componentsToCheck.filter(component =>
        this.componentExists(component)
      );
      if (foundComponents.length > 0) {
        const toSkip = await this.promptOverwrite(foundComponents);
        // cancel command if cancel clicked or if skipping every file to be retrieved
        if (!toSkip || toSkip.size === componentsToCheck.length) {
          return { type: 'CANCEL' };
        }
        if (data instanceof Array) {
          inputs.data = componentsToCheck.filter(
            selection => !toSkip.has(selection)
          );
        }
      }
      return inputs;
    }
    return { type: 'CANCEL' };
  }

  private componentExists(component: LocalComponent) {
    const { fileName, type, outputdir } = component;
    const info = MetadataDictionary.getInfo(type);
    const pathStrategy = info
      ? info.pathStrategy
      : PathStrategyFactory.createDefaultStrategy();
    return this.getFileExtensions(component).some(extension => {
      const path = join(
        workspaceUtils.getRootWorkspacePath(),
        pathStrategy.getPathToSource(outputdir, fileName, extension)
      );
      return existsSync(path);
    });
  }

  private getFileExtensions(component: LocalComponent) {
    const info = MetadataDictionary.getInfo(component.type);
    let metadataSuffix;
    if (component.suffix) {
      metadataSuffix = component.suffix;
    } else if (info && info.suffix) {
      metadataSuffix = info.suffix;
    } else {
      notificationService.showErrorMessage(
        nls.localize('error_overwrite_prompt')
      );
      telemetryService.sendException(
        'OverwriteComponentPromptException',
        `Missing suffix for ${component.type}`
      );
    }
    const extensions = [`.${metadataSuffix}-meta.xml`];
    if (info && info.extensions) {
      extensions.push(...info.extensions);
    }
    return extensions;
  }

  public async promptOverwrite(
    foundComponents: LocalComponent[]
  ): Promise<Set<LocalComponent> | undefined> {
    const skipped = new Set<LocalComponent>();
    for (let i = 0; i < foundComponents.length; i++) {
      const options = this.buildDialogOptions(foundComponents, skipped, i);
      const choice = await notificationService.showWarningModal(
        this.buildDialogMessage(foundComponents, i),
        ...options
      );
      const othersCount = foundComponents.length - i;
      switch (choice) {
        case nls.localize('warning_prompt_overwrite'):
          break;
        case nls.localize('warning_prompt_skip'):
          skipped.add(foundComponents[i]);
          break;
        case `${nls.localize('warning_prompt_overwrite_all')} (${othersCount})`:
          return skipped;
        case `${nls.localize('warning_prompt_skip_all')} (${othersCount})`:
          return new Set(foundComponents.slice(i));
        default:
          return; // Cancel
      }
    }
    return skipped;
  }

  private buildDialogMessage(
    foundComponents: LocalComponent[],
    currentIndex: number
  ) {
    const existingLength = foundComponents.length;
    const current = foundComponents[currentIndex];
    let body = '';
    for (let j = currentIndex + 1; j < existingLength; j++) {
      // Truncate components to show if there are more than 10 remaining
      if (j === currentIndex + 11) {
        const otherCount = existingLength - currentIndex - 11;
        body += nls.localize('warning_prompt_other_not_shown', otherCount);
        break;
      }
      const { fileName, type } = foundComponents[j];
      body += `${type}:${fileName}\n`;
    }
    const otherFilesCount = existingLength - currentIndex - 1;
    return nls.localize(
      'warning_prompt_overwrite_message',
      current.type,
      current.fileName,
      otherFilesCount > 0
        ? nls.localize('warning_prompt_other_existing', otherFilesCount)
        : '',
      body
    );
  }

  private buildDialogOptions(
    foundComponents: LocalComponent[],
    skipped: Set<LocalComponent>,
    currentIndex: number
  ) {
    const choices = [nls.localize('warning_prompt_overwrite')];
    const numOfExistingFiles = foundComponents.length;
    if (skipped.size > 0 || skipped.size !== numOfExistingFiles - 1) {
      choices.push(nls.localize('warning_prompt_skip'));
    }
    if (currentIndex < numOfExistingFiles - 1) {
      const othersCount = numOfExistingFiles - currentIndex;
      choices.push(
        `${nls.localize('warning_prompt_overwrite_all')} (${othersCount})`,
        `${nls.localize('warning_prompt_skip_all')} (${othersCount})`
      );
    }
    return choices;
  }
}

export class TimestampConflictChecker implements PostconditionChecker<string> {
  private isManifest: boolean;
  private messages: ConflictDetectionMessages;

  constructor(isManifest: boolean, messages: ConflictDetectionMessages) {
    this.messages = messages;
    this.isManifest = isManifest;
  }

  public async check(
    inputs: ContinueResponse<string> | CancelResponse
  ): Promise<ContinueResponse<string> | CancelResponse> {
    // If the current org is source-tracked, then source tracking
    // will handle conflict detection.
    const orgType = await getWorkspaceOrgType();
    if (
      orgType === OrgType.SourceTracked ||
      !sfdxCoreSettings.getConflictDetectionEnabled()
    ) {
      return inputs;
    }

    if (inputs.type === 'CONTINUE') {
      channelService.showChannelOutput();
      channelService.showCommandWithTimestamp(
        `${nls.localize('channel_starting_message')}${nls.localize(
          'conflict_detect_execution_name'
        )}\n`
      );

      const { username } = WorkspaceContext.getInstance();
      if (!username) {
        return {
          type: 'CANCEL',
          msg: nls.localize('conflict_detect_no_default_username')
        };
      }

      const componentPath = inputs.data;
      const cacheService = new MetadataCacheService(username);

      try {
        const result = await cacheService.loadCache(
          componentPath,
          workspaceUtils.getRootWorkspacePath(),
          this.isManifest
        );
        const detector = new TimestampConflictDetector();
        const diffs = detector.createDiffs(result);

        channelService.showCommandWithTimestamp(
          `${nls.localize('channel_end')} ${nls.localize(
            'conflict_detect_execution_name'
          )}\n`
        );
        return await this.handleConflicts(inputs.data, username, diffs);
      } catch (error) {
        console.error(error);
        const errorMsg = nls.localize(
          'conflict_detect_error',
          error.toString()
        );
        channelService.appendLine(errorMsg);
        telemetryService.sendException('ConflictDetectionException', errorMsg);
        await DeployQueue.get().unlock();
      }
    }
    return { type: 'CANCEL' };
  }

  public async handleConflicts(
    componentPath: string,
    usernameOrAlias: string,
    results: DirectoryDiffResults
  ): Promise<ContinueResponse<string> | CancelResponse> {
    const conflictTitle = nls.localize(
      'conflict_detect_view_root',
      usernameOrAlias,
      results.different.size
    );

    if (results.different.size === 0) {
      conflictView.visualizeDifferences(conflictTitle, usernameOrAlias, false);
    } else {
      channelService.appendLine(
        nls.localize(
          'conflict_detect_conflict_header_timestamp',
          results.different.size
        )
      );
      results.different.forEach(file => {
        channelService.appendLine(normalize(basename(file.localRelPath)));
      });

      const choice = await notificationService.showWarningModal(
        nls.localize(this.messages.warningMessageKey),
        nls.localize('conflict_detect_show_conflicts'),
        nls.localize('conflict_detect_override')
      );

      if (choice === nls.localize('conflict_detect_override')) {
        conflictView.visualizeDifferences(
          conflictTitle,
          usernameOrAlias,
          false
        );
      } else {
        channelService.appendLine(
          nls.localize(
            'conflict_detect_command_hint',
            this.messages.commandHint(componentPath)
          )
        );

        const doReveal =
          choice === nls.localize('conflict_detect_show_conflicts');
        conflictView.visualizeDifferences(
          conflictTitle,
          usernameOrAlias,
          doReveal,
          results
        );

        await DeployQueue.get().unlock();
        return { type: 'CANCEL' };
      }
    }
    return { type: 'CONTINUE', data: componentPath };
  }
}
