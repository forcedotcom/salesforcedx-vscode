/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalComponent, PostconditionChecker } from '@salesforce/salesforcedx-utils-vscode';
import { existsSync } from 'fs';
import { join } from 'path';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { telemetryService } from '../../telemetry';
import { ContinueOrCancel, isContinue, MetadataDictionary, OneOrMany, workspaceUtils } from '../../util';

import { PathStrategyFactory } from './sourcePathStrategies';

export class OverwriteComponentPrompt implements PostconditionChecker<OneOrMany> {
  public async check(inputs: ContinueOrCancel): Promise<ContinueOrCancel> {
    if (isContinue(inputs)) {
      const { data } = inputs;
      // normalize data into a list when processing
      const componentsToCheck = data instanceof Array ? data : [data];
      const foundComponents = componentsToCheck.filter(component => this.componentExists(component));

      if (foundComponents.length > 0) {
        const toSkip = await this.promptOverwrite(foundComponents);
        // cancel command if cancel clicked or if skipping every file to be retrieved
        if (!toSkip || toSkip.size === componentsToCheck.length) {
          return { type: 'CANCEL' };
        }

        if (data instanceof Array) {
          inputs.data = componentsToCheck.filter(selection => !toSkip.has(selection));
        }
      }

      return inputs;
    }
    return { type: 'CANCEL' };
  }

  private componentExists(component: LocalComponent) {
    const { fileName, type, outputdir } = component;
    const info = MetadataDictionary.getInfo(type);
    const pathStrategy = info ? info.pathStrategy : PathStrategyFactory.createDefaultStrategy();
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
      notificationService.showErrorMessage(nls.localize('error_overwrite_prompt'));
      telemetryService.sendException('OverwriteComponentPromptException', `Missing suffix for ${component.type}`);
    }

    const extensions = [`.${metadataSuffix}-meta.xml`];
    if (info && info.extensions) {
      extensions.push(...info.extensions);
    }

    return extensions;
  }

  public async promptOverwrite(foundComponents: LocalComponent[]): Promise<Set<LocalComponent> | undefined> {
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

  private buildDialogMessage(foundComponents: LocalComponent[], currentIndex: number) {
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
  }

  private buildDialogOptions(foundComponents: LocalComponent[], skipped: Set<LocalComponent>, currentIndex: number) {
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
