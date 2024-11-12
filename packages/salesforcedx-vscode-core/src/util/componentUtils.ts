/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CreateUtil } from '@salesforce/templates';
import * as fs from 'fs';
import * as path from 'path';

export const LWC = 'lwc';
export const AURA = 'aura';
export const TEST_FOLDER = '__tests__';

export const inputGuard = async (sourceFsPath: string, newName: string): Promise<string> => {
  const componentPath = await getComponentPath(sourceFsPath);
  if (isLwcComponent(componentPath)) {
    newName = newName.charAt(0).toLowerCase() + newName.slice(1);
  }
  CreateUtil.checkInputs(newName);
  return newName;
};

export const getLightningComponentDirectory = (sourceFsPath: string): string => {
  const directories = sourceFsPath.split(path.sep);
  const rootDir = directories.includes(LWC) ? LWC : AURA;
  const lwcDirectoryIndex = directories.lastIndexOf(rootDir);
  if (lwcDirectoryIndex > -1) {
    directories.splice(lwcDirectoryIndex + 2);
  }
  return directories.join(path.sep);
};

export const getComponentPath = async (sourceFsPath: string): Promise<string> => {
  const stats = await fs.promises.stat(sourceFsPath);
  let dirname = stats.isFile() ? path.dirname(sourceFsPath) : sourceFsPath;
  dirname = getLightningComponentDirectory(dirname);
  return dirname;
};

export const getComponentName = (componentPath: string): string => path.basename(componentPath);

export const isLwcComponent = (componentPath: string): boolean => path.basename(path.dirname(componentPath)) === LWC;

// for testing
export const componentUtils = {
  inputGuard,
  getComponentPath,
  getLightningComponentDirectory,
  getComponentName,
  isLwcComponent
};
