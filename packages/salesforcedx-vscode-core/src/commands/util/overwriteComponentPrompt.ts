/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { LocalComponent } from '../../util/types';
import {
  fileOrFolderExists,
  notificationService,
  PostconditionChecker,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { join } from 'node:path';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';
import { ContinueOrCancel, isContinue, MetadataDictionary, OneOrMany } from '../../util';

import { PathStrategyFactory } from './sourcePathStrategies';

/** Get file extensions for a component including metadata and any additional extensions */
const getFileExtensions = (component: LocalComponent) => {
  const info = MetadataDictionary.getInfo(component.type);
  const metadataSuffix = component.suffix ?? info?.suffix;

  if (!metadataSuffix) {
    notificationService.showErrorMessage(nls.localize('error_overwrite_prompt'));
    telemetryService.sendException('OverwriteComponentPromptException', `Missing suffix for ${component.type}`);
  }

  const extensions = [`.${metadataSuffix}-meta.xml`];
  if (info?.extensions) {
    extensions.push(...info.extensions);
  }

  return extensions;
};

/** Check if a component exists in the workspace */
const componentExists = async (component: LocalComponent) => {
  const { fileName, type, outputdir } = component;
  const info = MetadataDictionary.getInfo(type);
  const pathStrategy = info ? info.pathStrategy : PathStrategyFactory.createDefaultStrategy();
  return await Promise.all(
    getFileExtensions(component).map(async extension => {
      const path = join(
        workspaceUtils.getRootWorkspacePath(),
        pathStrategy.getPathToSource(outputdir, fileName, extension)
      );
      return await fileOrFolderExists(path);
    })
  );
};

/** Build the message shown in the overwrite dialog */
const buildDialogMessage = (foundComponents: LocalComponent[], currentIndex: number) => {
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
    otherFilesCount > 0 ? nls.localize('warning_prompt_other_existing', otherFilesCount) : '',
    body
  );
};

/** Build the options shown in the overwrite dialog */
const buildDialogOptions = (foundComponents: LocalComponent[], skipped: Set<LocalComponent>, currentIndex: number) => {
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
};

/** Prompt user to overwrite existing components */
const promptOverwrite = async (foundComponents: LocalComponent[]): Promise<Set<LocalComponent> | undefined> => {
  const skipped = new Set<LocalComponent>();
  for (let i = 0; i < foundComponents.length; i++) {
    const options = buildDialogOptions(foundComponents, skipped, i);
    const choice = await notificationService.showWarningModal(buildDialogMessage(foundComponents, i), ...options);
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
};

export class OverwriteComponentPrompt implements PostconditionChecker<OneOrMany> {
  public async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (isContinue(inputs)) {
      const { data } = inputs;
      // normalize data into a list when processing
      const componentsToCheck = Array.isArray(data) ? data : [data];

      // Check which components exist using Promise.all
      const foundComponents = (
        await Promise.all(
          componentsToCheck.map(async component => ({
            component,
            exists: await componentExists(component)
          }))
        )
      )
        // Filter components that exist (any of their files exist)
        .filter(result => result.exists.some(exists => exists))
        .map(result => result.component);

      if (foundComponents.length > 0) {
        const toSkip = await promptOverwrite(foundComponents);
        // cancel command if cancel clicked or if skipping every file to be retrieved
        if (!toSkip || toSkip.size === componentsToCheck.length) {
          return { type: 'CANCEL' };
        }

        if (Array.isArray(data)) {
          inputs.data = componentsToCheck.filter(selection => !toSkip.has(selection));
        }
      }

      return inputs;
    }
    return { type: 'CANCEL' };
  }
}
