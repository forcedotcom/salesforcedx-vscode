/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';

export const LWC = 'lwc';
export const AURA = 'aura';
export const TEST_FOLDER = '__tests__';

const getLightningComponentDirectory = (sourceFsPath: string): string => {
  const directories = sourceFsPath.split(path.sep);
  const rootDir = directories.includes(LWC) ? LWC : AURA;
  const lwcDirectoryIndex = directories.lastIndexOf(rootDir);
  if (lwcDirectoryIndex > -1) {
    directories.splice(lwcDirectoryIndex + 2);
  }
  return directories.join(path.sep);
};

export const getComponentPath = async (sourceFsPath: string): Promise<string> => {
  let dirname = (await isFile(sourceFsPath)) ? path.dirname(sourceFsPath) : sourceFsPath;
  dirname = getLightningComponentDirectory(dirname);
  return dirname;
};

export const getComponentName = (componentPath: string): string => path.basename(componentPath);

export const isLwcComponent = (componentPath: string): boolean => path.basename(path.dirname(componentPath)) === LWC;

// for testing
export const componentUtils = {
  getComponentPath,
  getLightningComponentDirectory,
  getComponentName,
  isLwcComponent
};
