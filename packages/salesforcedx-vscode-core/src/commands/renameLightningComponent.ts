/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode';
import { CreateUtil } from '@salesforce/templates';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { SfCommandlet, SfWorkspaceChecker } from './util';

const RENAME_LIGHTNING_COMPONENT_EXECUTOR = 'rename_lightning_component';
const RENAME_INPUT_PLACEHOLDER = 'rename_component_input_placeholder';
const RENAME_INPUT_PROMPT = 'rename_component_input_prompt';
const RENAME_INPUT_DUP_ERROR = 'rename_component_input_dup_error';
const RENAME_INPUT_DUP_FILE_NAME_ERROR =
  'rename_component_input_dup_file_name_error';
const RENAME_ERROR = 'rename_component_error';
const RENAME_WARNING = 'rename_component_warning';
const LWC = 'lwc';
const AURA = 'aura';
const TEST_FOLDER = '__tests__';

export class RenameLwcComponentExecutor extends LibraryCommandletExecutor<ComponentName> {
  private sourceFsPath: string;
  constructor(sourceFsPath: string) {
    super(
      nls.localize(RENAME_LIGHTNING_COMPONENT_EXECUTOR),
      RENAME_LIGHTNING_COMPONENT_EXECUTOR,
      OUTPUT_CHANNEL
    );
    this.sourceFsPath = sourceFsPath;
  }

  public async run(
    response: ContinueResponse<ComponentName>
  ): Promise<boolean> {
    let newComponentName = response.data.name?.trim();
    if (newComponentName && this.sourceFsPath) {
      newComponentName = await inputGuard(this.sourceFsPath, newComponentName);
      try {
        await renameComponent(this.sourceFsPath, newComponentName);
        return true;
      } catch (err) {
        const errorMessage = nls.localize(RENAME_ERROR);
        void notificationService.showErrorMessage(errorMessage);
        throw err;
      }
    }
    return false;
  }
}

export const renameLightningComponent = (sourceUri: vscode.Uri): void => {
  const sourceFsPath = sourceUri.fsPath;
  if (sourceFsPath) {
    const commandlet = new SfCommandlet(
      new SfWorkspaceChecker(),
      new GetComponentName(sourceFsPath),
      new RenameLwcComponentExecutor(sourceFsPath)
    );
    void commandlet.run();
  }
};
export type ComponentName = {
  name?: string;
};
export class GetComponentName implements ParametersGatherer<ComponentName> {
  private sourceFsPath: string;
  constructor(sourceFsPath: string) {
    this.sourceFsPath = sourceFsPath;
  }
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ComponentName>
  > {
    const inputOptions = {
      value: getComponentName(await getComponentPath(this.sourceFsPath)),
      placeHolder: nls.localize(RENAME_INPUT_PLACEHOLDER),
      promopt: nls.localize(RENAME_INPUT_PROMPT)
    } as vscode.InputBoxOptions;
    const inputResult = await vscode.window.showInputBox(inputOptions);
    return inputResult
      ? { type: 'CONTINUE', data: { name: inputResult } }
      : { type: 'CANCEL' };
  }
}

export const inputGuard = async (
  sourceFsPath: string,
  newName: string
): Promise<string> => {
  const componentPath = await getComponentPath(sourceFsPath);
  if (isLwcComponent(componentPath)) {
    newName = newName.charAt(0).toLowerCase() + newName.slice(1);
  }
  CreateUtil.checkInputs(newName);
  return newName;
};

const renameComponent = async (
  sourceFsPath: string,
  newName: string
): Promise<void> => {
  const componentPath = await getComponentPath(sourceFsPath);
  const componentName = getComponentName(componentPath);
  await checkForDuplicateName(componentPath, newName);
  const items = await fs.promises.readdir(componentPath);
  await checkForDuplicateInComponent(componentPath, newName, items);
  for (const item of items) {
    // only rename the file that has same name with component
    if (isNameMatch(item, componentName, componentPath)) {
      const newItem = item.replace(componentName, newName);
      await fs.promises.rename(
        path.join(componentPath, item),
        path.join(componentPath, newItem)
      );
    }
    if (item === TEST_FOLDER) {
      const testFolderPath = path.join(componentPath, TEST_FOLDER);
      const testFiles = await fs.promises.readdir(testFolderPath);
      for (const file of testFiles) {
        if (isNameMatch(file, componentName, componentPath)) {
          const newFile = file.replace(componentName, newName);
          await fs.promises.rename(
            path.join(testFolderPath, file),
            path.join(testFolderPath, newFile)
          );
        }
      }
    }
  }
  const newComponentPath = path.join(path.dirname(componentPath), newName);
  await fs.promises.rename(componentPath, newComponentPath);
  void notificationService.showWarningMessage(nls.localize(RENAME_WARNING));
};

export const getLightningComponentDirectory = (
  sourceFsPath: string
): string => {
  const directories = sourceFsPath.split(path.sep);
  const rootDir = directories.includes(LWC) ? LWC : AURA;
  const lwcDirectoryIndex = directories.lastIndexOf(rootDir);
  if (lwcDirectoryIndex > -1) {
    directories.splice(lwcDirectoryIndex + 2);
  }
  return directories.join(path.sep);
};

const getComponentPath = async (sourceFsPath: string): Promise<string> => {
  const stats = await fs.promises.stat(sourceFsPath);
  let dirname = stats.isFile() ? path.dirname(sourceFsPath) : sourceFsPath;
  dirname = getLightningComponentDirectory(dirname);
  return dirname;
};

const getComponentName = (componentPath: string): string =>
  path.basename(componentPath);

const checkForDuplicateName = async (
  componentPath: string,
  newName: string
) => {
  const isNameDuplicate = await isDuplicate(componentPath, newName);
  if (isNameDuplicate) {
    const errorMessage = nls.localize(RENAME_INPUT_DUP_ERROR);
    void notificationService.showErrorMessage(errorMessage);
    throw new Error(format(errorMessage));
  }
};

const isDuplicate = async (
  componentPath: string,
  newName: string
): Promise<boolean> => {
  // A LWC component can't share the same name as a Aura component
  const componentPathDirName = path.dirname(componentPath);
  let lwcPath: string;
  let auraPath: string;
  if (isLwcComponent(componentPath)) {
    lwcPath = componentPathDirName;
    auraPath = path.join(path.dirname(componentPathDirName), AURA);
  } else {
    lwcPath = path.join(path.dirname(componentPathDirName), LWC);
    auraPath = componentPathDirName;
  }
  const allLwcComponents = await fs.promises.readdir(lwcPath);
  const allAuraComponents = await fs.promises.readdir(auraPath);
  return (
    allLwcComponents.includes(newName) || allAuraComponents.includes(newName)
  );
};

/**
 * check duplicate name under current component directory and __tests__ directory to avoid file loss
 */
const checkForDuplicateInComponent = async (
  componentPath: string,
  newName: string,
  items: string[]
) => {
  let allFiles = items;
  if (items.includes(TEST_FOLDER)) {
    const testFiles = await fs.promises.readdir(
      path.join(componentPath, TEST_FOLDER)
    );
    allFiles = items.concat(testFiles);
  }
  const allFileNames = getOnlyFileNames(allFiles);
  if (allFileNames.includes(newName)) {
    const errorMessage = nls.localize(RENAME_INPUT_DUP_FILE_NAME_ERROR);
    void notificationService.showErrorMessage(errorMessage);
    throw new Error(format(errorMessage));
  }
};

const getOnlyFileNames = (allFiles: string[]) => {
  return allFiles.map(file => {
    const split = file?.split('.');
    return split?.length > 1 ? split[0] : '';
  });
};

export const isNameMatch = (
  item: string,
  componentName: string,
  componentPath: string
): boolean => {
  const isLwc = isLwcComponent(componentPath);
  const regularExp = isLwc
    ? new RegExp(`${componentName}\\.(html|js|js-meta.xml|css|svg|test.js)`)
    : new RegExp(
      `${componentName}(((Controller|Renderer|Helper)?\\.js)|(\\.(cmp|app|css|design|auradoc|svg|evt)))`
    );
  return Boolean(item.match(regularExp));
};

const isLwcComponent = (componentPath: string): boolean =>
  path.basename(path.dirname(componentPath)) === LWC;
